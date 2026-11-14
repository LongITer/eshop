# PC Builder catalog recommendations

`GET /product/api/pc-builder/catalog` accepts `slot`, `q`, `page`, `limit`,
`sort` (`recommended` by default, `priceAsc`, `priceDesc`) and optional `parts`.
`parts` is a JSON-encoded array of the same component references used by the quote
endpoint. Malformed references return 400. The selected product for the requested
slot is ignored so replacements are evaluated against the rest of the build.
Selected specifications are always loaded from available database products.

Candidates with a known compatibility conflict or no available stock are excluded
before pagination. Recommended sorting puts verified matches first, then components
without applicable checks, then those with missing/ambiguous specifications. Within
each group, higher available stock comes first, then lower price and product ID.
Available stock is the smaller of product stock and the sum of active SKU stock.
Explicit price sorting retains compatibility filtering but orders by price instead.

Each product includes `recommendation: { status, stock, checks }`. Status is
`matched`, `unchecked`, or `unknown`. Checks cover CPU/motherboard socket,
RAM/motherboard memory type, and GPU recommended PSU wattage versus PSU capacity,
regardless of selection order. No performance/bottleneck, BIOS, physical clearance,
connector, or cooling guarantee is implied. Missing specs remain visible with a
review warning. The final quote still validates selections, options, price and stock.

The UI includes the other selected references in its catalog query key and request,
clears comparisons and resets pagination when those references change. Sorting and
filtering occur across the complete matching category, rather than the current page.
This currently loads the category into service memory to reuse legacy specification
normalization; large catalogs should use indexed normalized specification fields.
