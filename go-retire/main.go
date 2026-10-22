package main

import (
	"bytes"
	"context"
	"embed"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
)

// Build information stamps injected via ldflags during compilation.
var (
	version   = "dev"
	gitCommit = "unknown"
	buildDate = "unknown"
)

// DefaultPort defines the standard localhost port for the standalone planner server.
const DefaultPort = 8999

// DefaultHost defines the local loopback interface address.
const DefaultHost = "127.0.0.1"

// Embedded static web bundle built from the Vite frontend.
//
//go:embed all:dist
var distFS embed.FS

func init() {
	// Register essential MIME types to guard against missing/misconfigured system registries.
	_ = mime.AddExtensionType(".js", "application/javascript")
	_ = mime.AddExtensionType(".mjs", "application/javascript")
	_ = mime.AddExtensionType(".css", "text/css")
	_ = mime.AddExtensionType(".svg", "image/svg+xml")
	_ = mime.AddExtensionType(".json", "application/json")
	_ = mime.AddExtensionType(".wasm", "application/wasm")
	_ = mime.AddExtensionType(".html", "text/html; charset=utf-8")
	_ = mime.AddExtensionType(".ico", "image/x-icon")
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")
}

// openBrowser attempts to open the default web browser to the specified URL.
func openBrowser(targetURL string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", targetURL)
	case "darwin":
		cmd = exec.Command("open", targetURL)
	default:
		cmd = exec.Command("xdg-open", targetURL)
	}
	_ = cmd.Start()
}

// serveFile reads and serves an HTML or static file with no-cache directives.
func serveFile(w http.ResponseWriter, r *http.Request, fsys fs.FS, name string) {
	f, err := fsys.Open(name)
	if err != nil {
		if name == "index.html" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte("<!DOCTYPE html><html><body style=\"font-family:sans-serif;text-align:center;padding:50px\"><h2>Retirement Planner Assets Not Built</h2><p>The frontend bundle has not been compiled yet. Run <code>./build-go.sh</code> or <code>npm run build</code> to generate the web assets.</p></body></html>\n"))
			return
		}
		http.NotFound(w, r)
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		http.NotFound(w, r)
		return
	}

	rs, ok := f.(io.ReadSeeker)
	if !ok {
		data, err := io.ReadAll(f)
		if err != nil {
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		rs = bytes.NewReader(data)
	}

	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	http.ServeContent(w, r, name, stat.ModTime(), rs)
}

// createRouter constructs an HTTP handler serving static assets and handling SPA fallback.
func createRouter(staticFS fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(staticFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Common security headers matching production Nginx policies
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		cleanPath := strings.TrimPrefix(filepath.Clean(r.URL.Path), "/")
		if cleanPath == "" || cleanPath == "." {
			serveFile(w, r, staticFS, "index.html")
			return
		}

		// Lightweight health check endpoint
		if cleanPath == "health" {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("healthy\n"))
			return
		}

		// Dedicated expenser application clean URL route
		if cleanPath == "expenser" || cleanPath == "expenser/" {
			serveFile(w, r, staticFS, "expenser.html")
			return
		}

		// Check if file exists in embedded assets
		if f, err := staticFS.Open(cleanPath); err == nil {
			stat, err := f.Stat()
			_ = f.Close()
			if err == nil && !stat.IsDir() {
				// Cache immutable static assets generated with content hashes
				if strings.HasPrefix(cleanPath, "assets/") {
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				}
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// SPA route fallback: serve expenser.html if subpath, otherwise main index.html
		if strings.HasPrefix(cleanPath, "expenser/") {
			serveFile(w, r, staticFS, "expenser.html")
			return
		}

		serveFile(w, r, staticFS, "index.html")
	})
}

func main() {
	var port int
	var host string
	var autoOpen bool
	var showVersion bool

	flag.IntVar(&port, "port", DefaultPort, "Port to listen on")
	flag.StringVar(&host, "host", DefaultHost, "Host address to bind to")
	flag.BoolVar(&autoOpen, "open", false, "Automatically open web browser on startup")
	flag.BoolVar(&showVersion, "version", false, "Print version information and exit")

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Retirement Planner - Standalone Local Server\n\n")
		fmt.Fprintf(os.Stderr, "Usage:\n")
		fmt.Fprintf(os.Stderr, "  %s [options]\n\n", filepath.Base(os.Args[0]))
		fmt.Fprintf(os.Stderr, "Options:\n")
		flag.PrintDefaults()
	}

	flag.Parse()

	if showVersion {
		fmt.Printf("Retirement Planner %s (commit: %s, built: %s)\n", version, gitCommit, buildDate)
		return
	}

	// Extract the root of the embedded dist folder
	staticFS, err := fs.Sub(distFS, "dist")
	if err != nil {
		log.Fatalf("Failed to initialize embedded web filesystem: %v", err)
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	localURL := fmt.Sprintf("http://localhost:%d", port)
	if host != "127.0.0.1" && host != "localhost" && host != "" {
		localURL = fmt.Sprintf("http://%s:%d", host, port)
	}

	router := createRouter(staticFS)

	server := &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	fmt.Println("============================================================")
	fmt.Println("  Retirement Planner Dashboard - Standalone Server")
	fmt.Println("============================================================")
	fmt.Printf("  Version:      %s (%s)\n", version, gitCommit)
	fmt.Printf("  Serving Port: %d\n", port)
	fmt.Printf("  Bound Addr:   %s\n", addr)
	fmt.Printf("  Access URL:   %s\n", localURL)
	fmt.Printf("  Expenser URL: %s/expenser\n", localURL)
	fmt.Println("============================================================")
	fmt.Println("Server is running. Press Ctrl+C to terminate.")

	if autoOpen {
		go func() {
			time.Sleep(100 * time.Millisecond)
			openBrowser(localURL)
		}()
	}

	// Trap termination signals for graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server listener error: %v", err)
		}
	}()

	<-stop
	fmt.Println("\nStopping server gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown warning: %v", err)
	}
	fmt.Println("Server stopped.")
}
