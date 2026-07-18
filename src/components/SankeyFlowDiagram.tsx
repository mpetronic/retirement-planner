import React, { useState } from 'react';
import { SimulationResultRow } from '../types';

interface SankeyFlowDiagramProps {
  row: SimulationResultRow;
}

interface NodeItem {
  id: string;
  label: string;
  value: number;
  color: string;
}

export const SankeyFlowDiagram: React.FC<SankeyFlowDiagramProps> = ({ row }) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null); // e.g. "source-salary" or "use-taxes"

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  // 1. Gather all cash source values
  const salary = (row.yourSalary ?? 0) + (row.wifeSalary ?? 0);
  const ss = row.yourSS + row.wifeSS;
  const rmd = row.yourRMD + row.wifeRMD;
  const divInterest = row.taxableDividends + row.taxableInterest;
  
  // Drawdowns
  const drawBrokerage = row.drawdownTaxable ?? 0;
  const drawPreTax = row.drawdownPreTax ?? 0;
  const drawRoth = row.drawdownRoth ?? 0;
  const drawCash = row.drawdownCash ?? 0;
  
  // Roth conversions (special asset transfers)
  const rothConv = row.intentionalRothConversion ?? 0;

  // 2. Gather all cash use values
  const living = row.livingExpenses ?? 0;
  const preMedicare = row.preMedicareHealthcareCost ?? 0;
  const medBase = row.medicareBasePremiums ?? 0;
  const medSurcharge = row.combinedSurchargeAnnual ?? 0;
  const taxes = row.fedIncomeTax + row.stateIncomeTax + row.niitTax;

  const totalExpenses = living + preMedicare + medBase + medSurcharge + taxes;
  const regularInflows = salary + ss + rmd + divInterest;
  const surplus = Math.max(0, regularInflows - totalExpenses);

  // 3. Define logical sources
  const sources: NodeItem[] = [
    { id: "salary", label: "Salary Income", value: salary, color: "#38bdf8" }, // sky-400
    { id: "ss", label: "Social Security", value: ss, color: "#60a5fa" }, // blue-400
    { id: "rmd", label: "Traditional IRA RMDs", value: rmd, color: "#818cf8" }, // indigo-400
    { id: "divInterest", label: "Dividends & Interest", value: divInterest, color: "#a78bfa" }, // purple-400
    { id: "drawBrokerage", label: "Brokerage Drawdown", value: drawBrokerage, color: "#fb7185" }, // rose-400
    { id: "drawPreTax", label: "Extra IRA Drawdown", value: drawPreTax, color: "#f43f5e" }, // rose-500
    { id: "drawRoth", label: "Roth IRA Drawdown", value: drawRoth, color: "#ec4899" }, // pink-500
    { id: "drawCash", label: "Cash Savings Draw", value: drawCash, color: "#fda4af" }, // rose-300
    { id: "rothConvSrc", label: "IRA (Conversion Src)", value: rothConv, color: "#fbbf24" } // amber-400
  ].filter(s => s.value > 0);

  // 4. Define logical uses
  const uses: NodeItem[] = [
    { id: "living", label: "Living Expenses", value: living, color: "#34d399" }, // emerald-400
    { id: "preMedicare", label: "Pre-Medicare Prem.", value: preMedicare, color: "#f97316" }, // orange-500
    { id: "medPremiums", label: "Medicare Base & Surcharge", value: medBase + medSurcharge, color: "#ef4444" }, // red-500
    { id: "taxes", label: "Income Taxes (Fed/State)", value: taxes, color: "#dc2626" }, // red-600
    { id: "rothConvDest", label: "Roth IRA (Conv. Dest)", value: rothConv, color: "#d97706" }, // amber-600
    { id: "surplus", label: "Reinvested Surplus", value: surplus, color: "#059669" } // emerald-600
  ].filter(u => u.value > 0);

  const sumSources = sources.reduce((acc, s) => acc + s.value, 0);
  const sumUses = uses.reduce((acc, u) => acc + u.value, 0);

  if (sumSources === 0 || sumUses === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <p className="text-sm font-semibold">No active cash flows in this simulation year.</p>
      </div>
    );
  }

  // Dimension settings
  const width = 680;
  const height = 360;
  const barWidth = 14;
  const gap = 12;

  // Node columns positions
  const xLeft = 50;
  const xCenter = 330;
  const xRight = 610;

  // Calculate layout coordinates for Column 0 (Sources)
  const sourceGaps = (sources.length - 1) * gap;
  const sourceScale = (height - sourceGaps) / sumSources;
  let currentSourceY = 0;
  const sourceNodes = sources.map(s => {
    const nodeHeight = s.value * sourceScale;
    const y = currentSourceY;
    currentSourceY += nodeHeight + gap;
    return { ...s, y, height: nodeHeight };
  });

  // Calculate layout coordinates for Column 1 (Pool Node)
  const poolHeight = height - 40; // centered with padding
  const poolY = 20;

  // Calculate layout coordinates for Column 2 (Uses)
  const useGaps = (uses.length - 1) * gap;
  const useScale = (height - useGaps) / sumUses;
  let currentUseY = 0;
  const useNodes = uses.map(u => {
    const nodeHeight = u.value * useScale;
    const y = currentUseY;
    currentUseY += nodeHeight + gap;
    return { ...u, y, height: nodeHeight };
  });

  // Helper to draw smooth bezier curves for ribbons
  const drawRibbon = (x1: number, y1: number, x2: number, y2: number, ribbonHeight: number) => {
    const ctrlX1 = x1 + (x2 - x1) / 3;
    const ctrlX2 = x2 - (x2 - x1) / 3;
    return `
      M ${x1} ${y1}
      C ${ctrlX1} ${y1}, ${ctrlX2} ${y2}, ${x2} ${y2}
      L ${x2} ${y2 + ribbonHeight}
      C ${ctrlX2} ${y2 + ribbonHeight}, ${ctrlX1} ${y1 + ribbonHeight}, ${x1} ${y1 + ribbonHeight}
      Z
    `;
  };

  // Track stacks for left and right connections on the central pool
  let runningSourcePoolY = poolY;
  let runningUsePoolY = poolY;

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center text-xs text-slate-400 px-2">
        <span>Sources of Funds (Inflows & Liquidations)</span>
        <span>Central Budget Pool</span>
        <span>Allocation of Funds (Taxes, Costs & Surplus)</span>
      </div>

      <div className="relative border border-slate-800/80 rounded-2xl bg-slate-950/40 p-4 overflow-hidden flex items-center justify-center">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="overflow-visible select-none">
          <defs>
            {/* Linear Gradients for links */}
            {sourceNodes.map(s => (
              <linearGradient id={`grad-${s.id}`} x1="0%" y1="0%" x2="100%" y2="0%" key={s.id}>
                <stop offset="0%" stopColor={s.color} stopOpacity={0.45} />
                <stop offset="100%" stopColor="#475569" stopOpacity={0.15} />
              </linearGradient>
            ))}
            {useNodes.map(u => (
              <linearGradient id={`grad-${u.id}`} x1="0%" y1="0%" x2="100%" y2="0%" key={u.id}>
                <stop offset="0%" stopColor="#475569" stopOpacity={0.15} />
                <stop offset="100%" stopColor={u.color} stopOpacity={0.45} />
              </linearGradient>
            ))}
          </defs>

          {/* Render Connections Left -> Center */}
          {sourceNodes.map(s => {
            const linkHeight = (s.value / sumSources) * poolHeight;
            const yPoolStart = runningSourcePoolY;
            runningSourcePoolY += linkHeight;

            const isHovered = hoveredNode === s.id || hoveredNode === "pool" || hoveredLink === `source-${s.id}`;
            const opacity = isHovered ? 0.8 : 0.3;

            return (
              <path
                key={`link-src-${s.id}`}
                d={drawRibbon(xLeft + barWidth, s.y, xCenter, yPoolStart, linkHeight)}
                fill={`url(#grad-${s.id})`}
                className="transition-all duration-300"
                style={{ opacity }}
                onMouseEnter={() => setHoveredLink(`source-${s.id}`)}
                onMouseLeave={() => setHoveredLink(null)}
              />
            );
          })}

          {/* Render Connections Center -> Right */}
          {useNodes.map(u => {
            const linkHeight = (u.value / sumUses) * poolHeight;
            const yPoolStart = runningUsePoolY;
            runningUsePoolY += linkHeight;

            const isHovered = hoveredNode === u.id || hoveredNode === "pool" || hoveredLink === `use-${u.id}`;
            const opacity = isHovered ? 0.8 : 0.3;

            return (
              <path
                key={`link-use-${u.id}`}
                d={drawRibbon(xCenter + barWidth, yPoolStart, xRight, u.y, linkHeight)}
                fill={`url(#grad-${u.id})`}
                className="transition-all duration-300"
                style={{ opacity }}
                onMouseEnter={() => setHoveredLink(`use-${u.id}`)}
                onMouseLeave={() => setHoveredLink(null)}
              />
            );
          })}

          {/* Render Column 0 (Sources) Nodes */}
          {sourceNodes.map(s => {
            const isHovered = hoveredNode === s.id || hoveredLink === `source-${s.id}`;
            return (
              <g
                key={`node-src-${s.id}`}
                onMouseEnter={() => setHoveredNode(s.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                <rect
                  x={xLeft}
                  y={s.y}
                  width={barWidth}
                  height={s.height}
                  fill={s.color}
                  rx={2}
                  className={`transition-all duration-300 ${isHovered ? 'brightness-125 filter drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]' : ''}`}
                />
                <text
                  x={xLeft - 8}
                  y={s.y + s.height / 2 + 3}
                  textAnchor="end"
                  fill={isHovered ? "#f1f5f9" : "#94a3b8"}
                  fontSize="10"
                  fontFamily="sans-serif"
                  fontWeight={isHovered ? "bold" : "normal"}
                  className="transition-colors duration-200"
                >
                  {s.label} ({formatCurrency(s.value)})
                </text>
              </g>
            );
          })}

          {/* Render Column 1 (Pool Node) */}
          <g
            onMouseEnter={() => setHoveredNode("pool")}
            onMouseLeave={() => setHoveredNode(null)}
            className="cursor-pointer"
          >
            <rect
              x={xCenter}
              y={poolY}
              width={barWidth}
              height={poolHeight}
              fill="#475569"
              rx={2}
              className={`transition-all duration-300 ${hoveredNode === "pool" ? 'brightness-125' : ''}`}
            />
            <text
              x={xCenter + barWidth / 2}
              y={poolY - 8}
              textAnchor="middle"
              fill={hoveredNode === "pool" ? "#f1f5f9" : "#64748b"}
              fontSize="9"
              fontFamily="sans-serif"
              fontWeight="bold"
              letterSpacing="0.5"
            >
              CASH POOL: {formatCurrency(sumSources)}
            </text>
          </g>

          {/* Render Column 2 (Uses) Nodes */}
          {useNodes.map(u => {
            const isHovered = hoveredNode === u.id || hoveredLink === `use-${u.id}`;
            return (
              <g
                key={`node-use-${u.id}`}
                onMouseEnter={() => setHoveredNode(u.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                <rect
                  x={xRight}
                  y={u.y}
                  width={barWidth}
                  height={u.height}
                  fill={u.color}
                  rx={2}
                  className={`transition-all duration-300 ${isHovered ? 'brightness-125 filter drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]' : ''}`}
                />
                <text
                  x={xRight + barWidth + 8}
                  y={u.y + u.height / 2 + 3}
                  textAnchor="start"
                  fill={isHovered ? "#f1f5f9" : "#94a3b8"}
                  fontSize="10"
                  fontFamily="sans-serif"
                  fontWeight={isHovered ? "bold" : "normal"}
                  className="transition-colors duration-200"
                >
                  {u.label} ({formatCurrency(u.value)})
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
