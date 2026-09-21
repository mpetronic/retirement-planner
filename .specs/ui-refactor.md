# UI Refactor for Retirement Planner

# Requirement

Redesign the UI for the Retirement Planner application to use a left side bar that is collapsed and
collapsible.  The sidebar should only be visible on the main dashboard page.  On the other pages,
the main content should take up the full width of the screen.

I want to be able to organize the pages in the sidebar in a way that makes sense, and that is easy
to navigate. It should allow for hierarchical organization of pages. For example, the current  "Edit
Parameters" contents should be grouped together under a heading called "Edit Parameters" or
something similar. I should be able to expand the "Edit Parameters" section to see all of the pages
under it. 

The sidebar should be able to be expanded and collapsed by clicking on an icon in the sidebar. 

You can utilize the remaining full-screen width for the main content area. Therefore, you should
organize the content in a way that makes sense given you have more space than currently exists in a
modal dialog.

The Overview, Taxable Income Planner, Lookback Ledger, Monte Carlo, Compare, and Actuals & Guardrails
should all be top-level items in the sidebar. The Edit Parameters should also be top level. Later we
will be adding more and more tools that we can put into the sidebar as well. 

Let's retain the top most area of the main page to display the KPIs (optionally enabled just like
the current implementation) as well as the current Flat, 10, 50, 90 options and the link to the documentation.





