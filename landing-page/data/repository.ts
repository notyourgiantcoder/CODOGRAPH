import type { RepoFile } from "@/types/graph";

/**
 * Synthetic repository used by every demo on the page.
 *
 * Nothing here was produced by analysing a real codebase: it is a hand-written,
 * plausible Next.js storefront so the graph, inspector, charts and simulated
 * assistant all have one consistent source of truth.
 */
export const REPOSITORY = {
  owner: "acme",
  name: "storefront",
  branch: "main",
  framework: "Next.js",
  commit: "4f2c9a1",
} as const;

export const FILES: RepoFile[] = [
  // ── Layer 0 · routes ────────────────────────────────────────────────────
  {
    id: "app-layout",
    path: "app/layout.tsx",
    category: "route",
    layer: 0,
    col: -2.5,
    exports: ["RootLayout"],
    imports: [
      { target: "components-header", kind: "import" },
      { target: "lib-config", kind: "import", symbols: ["siteConfig"] },
    ],
    complexity: 3,
    loc: 42,
    aliases: ["root layout", "app layout"],
    description: "Root layout that wraps every route with the global header and site metadata.",
    summary:
      "The outer frame of the app. Every page renders inside it, so it is the first thing loaded on any route.",
    body: `export const metadata = { title: siteConfig.name };

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}`,
  },
  {
    id: "app-home",
    path: "app/page.tsx",
    category: "route",
    layer: 0,
    col: -1.5,
    exports: ["HomePage"],
    imports: [
      { target: "components-product-grid", kind: "import" },
      { target: "hooks-use-products", kind: "import", symbols: ["useProducts"] },
      { target: "types-product", kind: "type" },
    ],
    complexity: 4,
    loc: 38,
    aliases: ["home page", "homepage", "landing route", "index page"],
    description: "Storefront home page showing featured products in a grid.",
    summary: "The home page. It asks for featured products and hands them to the product grid.",
    body: `export default function HomePage() {
  const { products, isLoading } = useProducts({ featured: true });
  const featured: Product[] = products.slice(0, 8);

  return (
    <section>
      <h1>New this week</h1>
      <ProductGrid products={featured} loading={isLoading} />
    </section>
  );
}`,
  },
  {
    id: "app-products-page",
    path: "app/products/page.tsx",
    category: "route",
    layer: 0,
    col: -0.5,
    exports: ["ProductsPage"],
    imports: [
      { target: "components-search-bar", kind: "import" },
      { target: "components-product-grid", kind: "import" },
      { target: "components-filter-panel", kind: "import" },
      { target: "hooks-use-products", kind: "import", symbols: ["useProducts"] },
    ],
    complexity: 7,
    loc: 64,
    aliases: ["products page", "product listing page", "catalog page", "product list page", "catalogue"],
    description: "Catalog route combining search, filters and the product grid.",
    summary:
      "The catalog page. It wires the search bar and filter panel to the product list so shoppers can narrow results.",
    body: `export default function ProductsPage({ searchParams }: Props) {
  const filters = parseFilters(searchParams);
  const { products, isLoading } = useProducts(filters);

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <FilterPanel value={filters} />
      <div>
        <SearchBar defaultValue={filters.q} />
        <ProductGrid products={products} loading={isLoading} />
      </div>
    </div>
  );
}`,
  },
  {
    id: "app-product-detail-page",
    path: "app/products/[id]/page.tsx",
    category: "route",
    layer: 0,
    col: 0.5,
    exports: ["ProductDetailPage"],
    imports: [
      { target: "components-product-detail", kind: "import" },
      { target: "hooks-use-products", kind: "import", symbols: ["useProduct"] },
    ],
    complexity: 5,
    loc: 47,
    aliases: ["product detail page", "product page", "pdp", "product details page"],
    description: "Dynamic route that renders a single product by id.",
    summary: "The page for one product. It loads a product by its id and renders the detail view.",
    body: `export default function ProductDetailPage({ params }: Props) {
  const { product, isLoading } = useProduct(params.id);

  if (isLoading) return <DetailSkeleton />;
  if (!product) return notFound();

  return <ProductDetail product={product} />;
}`,
  },
  {
    id: "app-cart-page",
    path: "app/cart/page.tsx",
    category: "route",
    layer: 0,
    col: 1.5,
    exports: ["CartPage"],
    imports: [
      { target: "components-cart-summary", kind: "import" },
      { target: "hooks-use-cart", kind: "import", symbols: ["useCart"] },
    ],
    complexity: 4,
    loc: 36,
    aliases: ["cart page", "basket page", "shopping cart page"],
    description: "Cart route listing line items and totals.",
    summary: "The cart page. It reads the current cart and shows a summary with totals.",
    body: `export default function CartPage() {
  const { items, isEmpty } = useCart();

  if (isEmpty) return <EmptyCart />;

  return <CartSummary items={items} editable />;
}`,
  },
  {
    id: "app-checkout-page",
    path: "app/checkout/page.tsx",
    category: "route",
    layer: 0,
    col: 2.5,
    exports: ["CheckoutPage"],
    imports: [
      { target: "components-checkout-form", kind: "import" },
      { target: "components-cart-summary", kind: "import" },
    ],
    complexity: 5,
    loc: 51,
    aliases: ["checkout page", "checkout route"],
    description: "Checkout route pairing the order form with a read-only cart summary.",
    summary: "The checkout page. It shows the order form next to a summary of what is being bought.",
    body: `export default function CheckoutPage() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <CheckoutForm />
      <aside>
        <CartSummary readOnly />
      </aside>
    </div>
  );
}`,
  },

  // ── Layer 1 · page-level components ─────────────────────────────────────
  {
    id: "components-header",
    path: "components/Header.tsx",
    category: "component",
    layer: 1,
    col: -3,
    exports: ["Header"],
    imports: [
      { target: "components-search-bar", kind: "import" },
      { target: "components-cart-badge", kind: "import" },
    ],
    complexity: 6,
    loc: 72,
    aliases: ["header", "site header", "navbar", "navigation bar"],
    description: "Global header with brand, search and the cart badge.",
    summary: "The bar across the top of every page. It holds the search box and the cart icon.",
    body: `export function Header() {
  return (
    <header className="sticky top-0 border-b bg-background/80">
      <Logo />
      <SearchBar compact />
      <nav>
        <Link href="/products">Shop</Link>
        <CartBadge />
      </nav>
    </header>
  );
}`,
  },
  {
    id: "components-search-bar",
    path: "components/SearchBar.tsx",
    category: "component",
    layer: 1,
    col: -2,
    exports: ["SearchBar"],
    imports: [{ target: "hooks-use-search", kind: "import", symbols: ["useSearch"] }],
    complexity: 9,
    loc: 88,
    aliases: ["search bar", "searchbar", "search box", "search input"],
    description: "Debounced search input with an inline suggestions dropdown.",
    summary: "The search box. As you type it asks for suggestions and shows them in a dropdown.",
    body: `export function SearchBar({ compact, defaultValue }: Props) {
  const [query, setQuery] = useState(defaultValue ?? "");
  const { results, isSearching } = useSearch(query);

  return (
    <Combobox value={query} onChange={setQuery}>
      <Combobox.Input placeholder="Search products" />
      {results.map((r) => (
        <Combobox.Option key={r.id} value={r}>{r.name}</Combobox.Option>
      ))}
    </Combobox>
  );
}`,
  },
  {
    id: "components-product-grid",
    path: "components/ProductGrid.tsx",
    category: "component",
    layer: 1,
    col: -1,
    exports: ["ProductGrid"],
    imports: [
      { target: "components-product-card", kind: "import" },
      { target: "types-product", kind: "type" },
    ],
    complexity: 5,
    loc: 46,
    aliases: ["product grid", "productgrid", "grid of products"],
    description: "Responsive grid that lays out product cards with loading skeletons.",
    summary: "Lays products out in a responsive grid, one ProductCard per item.",
    body: `export function ProductGrid({ products, loading }: Props) {
  if (loading) return <GridSkeleton count={8} />;

  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {products.map((product: Product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}`,
  },
  {
    id: "components-filter-panel",
    path: "components/FilterPanel.tsx",
    category: "component",
    layer: 1,
    col: 0,
    exports: ["FilterPanel"],
    imports: [
      { target: "hooks-use-products", kind: "import", symbols: ["useProductFilters"] },
      { target: "types-product", kind: "type", symbols: ["ProductCategory"] },
    ],
    complexity: 11,
    loc: 104,
    aliases: ["filter panel", "filters", "filter sidebar"],
    description: "Category, price and availability filters synced to the URL.",
    summary: "The sidebar of filters on the catalog. It lists categories and price ranges and keeps them in the URL.",
    body: `export function FilterPanel({ value }: Props) {
  const { categories, priceRange } = useProductFilters();
  const router = useRouter();

  const toggle = (category: ProductCategory) =>
    router.replace(withParam("category", category));

  return (
    <aside>
      {categories.map((c) => (
        <Checkbox key={c} checked={value.category === c} onChange={() => toggle(c)} />
      ))}
      <PriceSlider range={priceRange} />
    </aside>
  );
}`,
  },
  {
    id: "components-product-detail",
    path: "components/ProductDetail.tsx",
    category: "component",
    layer: 1,
    col: 1,
    exports: ["ProductDetail"],
    imports: [
      { target: "components-price-tag", kind: "import" },
      { target: "components-add-to-cart-button", kind: "import" },
      { target: "types-product", kind: "type" },
    ],
    complexity: 8,
    loc: 96,
    aliases: ["product detail", "product details", "productdetail"],
    description: "Full product view with gallery, price, variants and add-to-cart.",
    summary: "The big view of one product: photos, description, price and the add-to-cart button.",
    body: `export function ProductDetail({ product }: { product: Product }) {
  const [variant, setVariant] = useState(product.variants[0]);

  return (
    <article className="grid gap-10 md:grid-cols-2">
      <Gallery images={product.images} />
      <div>
        <h1>{product.name}</h1>
        <PriceTag amount={variant.price} compareAt={product.compareAt} />
        <VariantPicker value={variant} onChange={setVariant} />
        <AddToCartButton product={product} variant={variant} />
      </div>
    </article>
  );
}`,
  },
  {
    id: "components-cart-summary",
    path: "components/CartSummary.tsx",
    category: "component",
    layer: 1,
    col: 2,
    exports: ["CartSummary"],
    imports: [
      { target: "components-price-tag", kind: "import" },
      { target: "hooks-use-cart", kind: "import", symbols: ["useCart"] },
      { target: "types-cart", kind: "type", symbols: ["CartItem"] },
    ],
    complexity: 10,
    loc: 92,
    aliases: ["cart summary", "order summary", "cartsummary"],
    description: "Line items, quantity controls and subtotal/tax/total breakdown.",
    summary: "Shows what is in the cart and adds up the totals. It can be editable or read-only.",
    body: `export function CartSummary({ editable, readOnly }: Props) {
  const { items, subtotal, tax, total, updateQuantity } = useCart();

  return (
    <div>
      {items.map((item: CartItem) => (
        <LineItem key={item.id} item={item} onQuantity={editable ? updateQuantity : undefined} />
      ))}
      <dl>
        <dt>Subtotal</dt><dd><PriceTag amount={subtotal} /></dd>
        <dt>Tax</dt><dd><PriceTag amount={tax} /></dd>
        <dt>Total</dt><dd><PriceTag amount={total} emphasis /></dd>
      </dl>
    </div>
  );
}`,
  },
  {
    id: "components-checkout-form",
    path: "components/CheckoutForm.tsx",
    category: "component",
    layer: 1,
    col: 3,
    exports: ["CheckoutForm"],
    imports: [
      { target: "components-price-tag", kind: "import" },
      { target: "hooks-use-checkout", kind: "import", symbols: ["useCheckout"] },
      { target: "lib-validation", kind: "import", symbols: ["checkoutSchema"] },
    ],
    complexity: 14,
    loc: 148,
    aliases: ["checkout form", "checkoutform", "payment form", "order form"],
    description: "Multi-step shipping and payment form with schema validation.",
    summary: "The form where shoppers enter shipping details and place the order. It validates input before submitting.",
    body: `export function CheckoutForm() {
  const { submit, total, status } = useCheckout();
  const form = useForm({ schema: checkoutSchema });

  return (
    <form onSubmit={form.handleSubmit(submit)}>
      <ShippingFields register={form.register} />
      <PaymentFields register={form.register} />
      <Button disabled={status === "pending"}>
        Pay <PriceTag amount={total} />
      </Button>
    </form>
  );
}`,
  },

  // ── Layer 2 · leaf components ───────────────────────────────────────────
  {
    id: "components-cart-badge",
    path: "components/CartBadge.tsx",
    category: "component",
    layer: 2,
    col: -3,
    exports: ["CartBadge"],
    imports: [{ target: "hooks-use-cart", kind: "import", symbols: ["useCart"] }],
    complexity: 2,
    loc: 24,
    aliases: ["cart badge", "cart icon", "cartbadge"],
    description: "Header cart icon with a live item count.",
    summary: "The little cart icon with a number on it showing how many items are in the cart.",
    body: `export function CartBadge() {
  const { count } = useCart();

  return (
    <Link href="/cart" aria-label={\`Cart, \${count} items\`}>
      <ShoppingBag />
      {count > 0 && <span className="badge">{count}</span>}
    </Link>
  );
}`,
  },
  {
    id: "components-product-card",
    path: "components/ProductCard.tsx",
    category: "component",
    layer: 2,
    col: -1,
    exports: ["ProductCard"],
    imports: [
      { target: "components-price-tag", kind: "import" },
      { target: "components-add-to-cart-button", kind: "import" },
      { target: "types-product", kind: "type" },
    ],
    complexity: 6,
    loc: 58,
    aliases: ["product card", "productcard", "product tile"],
    description: "Card showing a product image, name, price and quick add-to-cart.",
    summary:
      "A small tile for one product: picture, name, price and an add-to-cart button. The product grid repeats it for each item.",
    body: `export function ProductCard({ product }: { product: Product }) {
  return (
    <li className="group rounded-xl border p-3">
      <Link href={\`/products/\${product.id}\`}>
        <Image src={product.image} alt={product.name} />
        <h3>{product.name}</h3>
      </Link>
      <PriceTag amount={product.price} compareAt={product.compareAt} />
      <AddToCartButton product={product} size="sm" />
    </li>
  );
}`,
  },
  {
    id: "components-price-tag",
    path: "components/PriceTag.tsx",
    category: "component",
    layer: 2,
    col: 0,
    exports: ["PriceTag"],
    imports: [{ target: "lib-format-currency", kind: "import", symbols: ["formatCurrency"] }],
    complexity: 3,
    loc: 28,
    aliases: ["price tag", "pricetag", "price label"],
    description: "Formats and renders a price, with optional compare-at strikethrough.",
    summary: "Displays a price in the right currency format, optionally with the old price crossed out.",
    body: `export function PriceTag({ amount, compareAt, emphasis }: Props) {
  return (
    <span className={emphasis ? "font-semibold" : undefined}>
      {formatCurrency(amount)}
      {compareAt && <s className="ml-2 opacity-60">{formatCurrency(compareAt)}</s>}
    </span>
  );
}`,
  },
  {
    id: "components-add-to-cart-button",
    path: "components/AddToCartButton.tsx",
    category: "component",
    layer: 2,
    col: 1,
    exports: ["AddToCartButton"],
    imports: [
      { target: "hooks-use-cart", kind: "import", symbols: ["useCart"] },
      { target: "types-product", kind: "type" },
    ],
    complexity: 5,
    loc: 41,
    aliases: ["add to cart button", "add-to-cart button", "addtocartbutton", "add to cart"],
    description: "Button that adds a product variant to the cart with optimistic feedback.",
    summary: "The button that puts a product in the cart. It updates instantly and confirms when the server agrees.",
    body: `export function AddToCartButton({ product, variant, size }: Props) {
  const { addItem, isPending } = useCart();

  return (
    <Button size={size} disabled={isPending} onClick={() => addItem(product, variant)}>
      {isPending ? "Adding…" : "Add to cart"}
    </Button>
  );
}`,
  },

  // ── Layer 3 · hooks ─────────────────────────────────────────────────────
  {
    id: "hooks-use-debounce",
    path: "hooks/useDebounce.ts",
    category: "hook",
    layer: 3,
    col: -3,
    exports: ["useDebounce"],
    imports: [],
    complexity: 2,
    loc: 18,
    aliases: ["debounce hook", "usedebounce"],
    description: "Delays a changing value until it has been stable for a given time.",
    summary: "Waits until a value stops changing for a moment before passing it on. Used to avoid searching on every keystroke.",
    body: `export function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}`,
  },
  {
    id: "hooks-use-search",
    path: "hooks/useSearch.ts",
    category: "hook",
    layer: 3,
    col: -2,
    exports: ["useSearch"],
    imports: [
      { target: "hooks-use-debounce", kind: "import" },
      { target: "lib-api-client", kind: "import", symbols: ["apiClient"] },
      { target: "api-search", kind: "fetch" },
      { target: "types-product", kind: "type", symbols: ["ProductSummary"] },
    ],
    complexity: 7,
    loc: 44,
    aliases: ["search hook", "usesearch"],
    description: "Debounced client-side search against the search API.",
    summary: "Turns what you type into search results by calling the search endpoint, but only after you pause typing.",
    body: `export function useSearch(query: string) {
  const q = useDebounce(query.trim(), 200);

  return useQuery({
    queryKey: ["search", q],
    enabled: q.length > 1,
    queryFn: () => apiClient<ProductSummary[]>(\`/api/search?q=\${encodeURIComponent(q)}\`),
  });
}`,
  },
  {
    id: "hooks-use-products",
    path: "hooks/useProducts.ts",
    category: "hook",
    layer: 3,
    col: -0.5,
    exports: ["useProducts", "useProduct", "useProductFilters"],
    imports: [
      { target: "lib-api-client", kind: "import", symbols: ["apiClient"] },
      { target: "api-products", kind: "fetch" },
      { target: "types-product", kind: "type", symbols: ["Product", "ProductFilters"] },
    ],
    complexity: 9,
    loc: 76,
    aliases: ["products hook", "product hook", "useproducts", "useproduct", "product fetching hook"],
    description: "Client hooks for listing, loading and filtering products via the products API.",
    summary:
      "The client-side way to get product data. Pages call it, and it fetches from the products endpoint and caches the result.",
    body: `export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: ["products", filters],
    queryFn: () => apiClient<Product[]>("/api/products", { params: filters }),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => apiClient<Product>(\`/api/products/\${id}\`),
  });
}`,
  },
  {
    id: "hooks-use-cart",
    path: "hooks/useCart.ts",
    category: "hook",
    layer: 3,
    col: 1,
    exports: ["useCart"],
    imports: [
      { target: "lib-api-client", kind: "import", symbols: ["apiClient"] },
      { target: "api-cart", kind: "fetch" },
      { target: "types-cart", kind: "type", symbols: ["Cart", "CartItem"] },
    ],
    complexity: 12,
    loc: 118,
    aliases: ["cart hook", "usecart", "cart state hook", "cart state"],
    description: "Cart state with optimistic add, remove and quantity updates synced to the cart API.",
    summary:
      "Keeps track of what is in the cart. Components use it to read items and totals, and to add or remove products.",
    body: `export function useCart() {
  const { data: cart } = useQuery({ queryKey: ["cart"], queryFn: () => apiClient<Cart>("/api/cart") });

  const addItem = useOptimisticMutation((item: CartItem) =>
    apiClient("/api/cart", { method: "POST", body: item }),
  );

  const count = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;

  return { ...cart, count, addItem, isEmpty: count === 0 };
}`,
  },
  {
    id: "hooks-use-checkout",
    path: "hooks/useCheckout.ts",
    category: "hook",
    layer: 3,
    col: 2,
    exports: ["useCheckout"],
    imports: [
      { target: "hooks-use-cart", kind: "import" },
      { target: "lib-api-client", kind: "import", symbols: ["apiClient"] },
      { target: "api-checkout", kind: "fetch" },
      { target: "types-order", kind: "type", symbols: ["Order", "CheckoutInput"] },
    ],
    complexity: 10,
    loc: 67,
    aliases: ["checkout hook", "usecheckout"],
    description: "Submits the checkout payload and tracks order status.",
    summary: "Sends the finished order to the server and reports whether it is pending, paid or failed.",
    body: `export function useCheckout() {
  const { total, clear } = useCart();

  const mutation = useMutation({
    mutationFn: (input: CheckoutInput) =>
      apiClient<Order>("/api/checkout", { method: "POST", body: input }),
    onSuccess: () => clear(),
  });

  return { submit: mutation.mutate, status: mutation.status, total };
}`,
  },

  // ── Layer 4 · shared client utilities ───────────────────────────────────
  {
    id: "lib-api-client",
    path: "lib/apiClient.ts",
    category: "utility",
    layer: 4,
    col: 0.25,
    exports: ["apiClient"],
    imports: [{ target: "lib-config", kind: "import", symbols: ["siteConfig"] }],
    complexity: 8,
    loc: 63,
    aliases: ["api client", "apiclient", "fetch wrapper", "http client"],
    description: "Typed fetch wrapper with base URL, JSON handling and error normalisation.",
    summary: "A small helper every hook uses to talk to the server. It adds the base URL and turns errors into one shape.",
    body: `export async function apiClient<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const url = new URL(path, siteConfig.apiBaseUrl);
  if (init.params) appendParams(url, init.params);

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}`,
  },
  {
    id: "lib-format-currency",
    path: "lib/formatCurrency.ts",
    category: "utility",
    layer: 4,
    col: -1.25,
    exports: ["formatCurrency"],
    imports: [{ target: "lib-config", kind: "import", symbols: ["siteConfig"] }],
    complexity: 2,
    loc: 16,
    aliases: ["format currency", "formatcurrency", "currency formatter", "money formatting"],
    description: "Locale-aware currency formatting based on the store configuration.",
    summary: "Turns a number like 1999 into a readable price like $19.99 using the store's currency.",
    body: `const formatter = new Intl.NumberFormat(siteConfig.locale, {
  style: "currency",
  currency: siteConfig.currency,
});

export function formatCurrency(cents: number): string {
  return formatter.format(cents / 100);
}`,
  },
  {
    id: "lib-validation",
    path: "lib/validation.ts",
    category: "utility",
    layer: 4,
    col: 3,
    exports: ["checkoutSchema"],
    imports: [
      { target: "types-order", kind: "type", symbols: ["CheckoutInput"] },
      { target: "types-cart", kind: "type", symbols: ["CartItem"] },
    ],
    complexity: 9,
    loc: 71,
    aliases: ["validation", "validation schema", "checkout schema", "validators"],
    description: "Shared validation schemas used by both the checkout form and the checkout API.",
    summary: "Rules that decide whether checkout data is valid. The same rules run in the browser and on the server.",
    body: `export const cartItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1).max(20),
}) satisfies Schema<CartItem>;

export const checkoutSchema = z.object({
  email: z.string().email(),
  shipping: addressSchema,
  items: z.array(cartItemSchema).nonempty(),
}) satisfies Schema<CheckoutInput>;`,
  },

  // ── Layer 5 · API routes ────────────────────────────────────────────────
  {
    id: "api-search",
    path: "api/search/route.ts",
    category: "api",
    layer: 5,
    col: -2,
    exports: ["GET"],
    imports: [
      { target: "lib-search", kind: "import", symbols: ["searchProducts"] },
      { target: "types-product", kind: "type", symbols: ["ProductSummary"] },
    ],
    complexity: 4,
    loc: 29,
    aliases: ["search api", "search endpoint", "search route", "/api/search"],
    description: "GET /api/search — returns ranked product suggestions for a query.",
    summary: "The server endpoint behind the search box. It takes a query and returns matching products.",
    body: `export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.length < 2) return Response.json([]);

  const results: ProductSummary[] = await searchProducts(q, { limit: 8 });
  return Response.json(results);
}`,
  },
  {
    id: "api-products",
    path: "api/products/route.ts",
    category: "api",
    layer: 5,
    col: -0.5,
    exports: ["GET"],
    imports: [
      { target: "lib-products", kind: "import", symbols: ["getProducts", "getProductById"] },
      { target: "lib-cache", kind: "import", symbols: ["withCache"] },
      { target: "types-product", kind: "type", symbols: ["ProductFilters"] },
    ],
    complexity: 6,
    loc: 48,
    aliases: ["products api", "products endpoint", "products route", "/api/products", "product api"],
    description: "GET /api/products — lists or fetches products with cached responses.",
    summary: "The server endpoint that returns product data. It reads from the product data layer and caches the answer.",
    body: `export async function GET(request: Request) {
  const filters: ProductFilters = parseFilters(new URL(request.url).searchParams);

  const products = await withCache(\`products:\${hash(filters)}\`, () =>
    filters.id ? getProductById(filters.id) : getProducts(filters),
  );

  return Response.json(products);
}`,
  },
  {
    id: "api-cart",
    path: "api/cart/route.ts",
    category: "api",
    layer: 5,
    col: 1,
    exports: ["GET", "POST"],
    imports: [
      { target: "lib-cart", kind: "import", symbols: ["getCart", "addToCart"] },
      { target: "types-cart", kind: "type", symbols: ["CartItem"] },
    ],
    complexity: 7,
    loc: 55,
    aliases: ["cart api", "cart endpoint", "cart route", "/api/cart"],
    description: "GET/POST /api/cart — reads and mutates the session cart.",
    summary: "The server endpoint for the cart. It returns the current cart and accepts new items.",
    body: `export async function GET() {
  return Response.json(await getCart(sessionId()));
}

export async function POST(request: Request) {
  const item: CartItem = await request.json();
  const cart = await addToCart(sessionId(), item);
  return Response.json(cart, { status: 201 });
}`,
  },
  {
    id: "api-checkout",
    path: "api/checkout/route.ts",
    category: "api",
    layer: 5,
    col: 2,
    exports: ["POST"],
    imports: [
      { target: "lib-orders", kind: "import", symbols: ["createOrder"] },
      { target: "lib-validation", kind: "import", symbols: ["checkoutSchema"] },
    ],
    complexity: 11,
    loc: 83,
    aliases: ["checkout api", "checkout endpoint", "checkout route", "/api/checkout"],
    description: "POST /api/checkout — validates input and creates an order.",
    summary: "The server endpoint that places an order. It re-checks the data, then creates the order.",
    body: `export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ errors: parsed.error.flatten() }, { status: 422 });
  }

  const order = await createOrder(sessionId(), parsed.data);
  return Response.json(order, { status: 201 });
}`,
  },

  // ── Layer 6 · server data layer ─────────────────────────────────────────
  {
    id: "lib-search",
    path: "lib/search.ts",
    category: "utility",
    layer: 6,
    col: -2.5,
    exports: ["searchProducts"],
    imports: [
      { target: "lib-products", kind: "import", symbols: ["getProducts"] },
      { target: "lib-cache", kind: "import", symbols: ["withCache"] },
    ],
    complexity: 13,
    loc: 97,
    aliases: ["search service", "search lib", "search logic", "ranking"],
    description: "Fuzzy product search with ranking, built on the product data layer.",
    summary: "Finds products that match a query and sorts the best matches first.",
    body: `export async function searchProducts(q: string, { limit = 10 } = {}) {
  const catalog = await withCache("catalog:index", () => getProducts({ active: true }));

  return catalog
    .map((p) => ({ product: p, score: rank(p, tokenize(q)) }))
    .filter((r) => r.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ product }) => toSummary(product));
}`,
  },
  {
    id: "lib-products",
    path: "lib/products.ts",
    category: "utility",
    layer: 6,
    col: -1.25,
    exports: ["getProducts", "getProductById"],
    imports: [
      { target: "lib-cache", kind: "import", symbols: ["invalidate"] },
      { target: "lib-database", kind: "import", symbols: ["db"] },
      { target: "types-product", kind: "type", symbols: ["Product", "ProductFilters"] },
    ],
    complexity: 15,
    loc: 132,
    aliases: [
      "product data layer",
      "products data layer",
      "data layer",
      "product repository",
      "products lib",
      "products service",
      "product service",
    ],
    description: "Product data layer: queries, mapping and cache invalidation for products.",
    summary:
      "The single place that reads products from the database and shapes them for the rest of the app.",
    body: `export async function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const rows = await db.product.findMany({
    where: toWhere(filters),
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const row = await db.product.findUnique({ where: { id } });
  return row ? toProduct(row) : null;
}`,
  },
  {
    id: "lib-cache",
    path: "lib/cache.ts",
    category: "utility",
    layer: 6,
    col: 0,
    exports: ["withCache", "invalidate"],
    imports: [{ target: "lib-config", kind: "import", symbols: ["siteConfig"] }],
    complexity: 8,
    loc: 61,
    aliases: ["cache", "caching layer", "cache layer"],
    description: "In-memory TTL cache with tag-based invalidation.",
    summary: "Remembers expensive results for a short time so repeated requests are fast.",
    body: `const store = new Map<string, { value: unknown; expires: number }>();

export async function withCache<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const value = await load();
  store.set(key, { value, expires: Date.now() + siteConfig.cacheTtlMs });
  return value;
}`,
  },
  {
    id: "lib-cart",
    path: "lib/cart.ts",
    category: "utility",
    layer: 6,
    col: 1.25,
    exports: ["getCart", "addToCart"],
    imports: [
      { target: "lib-database", kind: "import", symbols: ["db"] },
      { target: "types-cart", kind: "type", symbols: ["Cart", "CartItem"] },
    ],
    complexity: 12,
    loc: 109,
    aliases: ["cart service", "cart lib", "cart data layer"],
    description: "Server-side cart persistence and price recalculation.",
    summary: "Saves carts in the database and recalculates totals when items change.",
    body: `export async function addToCart(sessionId: string, item: CartItem): Promise<Cart> {
  await db.cartItem.upsert({
    where: { sessionId_productId: { sessionId, productId: item.productId } },
    create: { sessionId, ...item },
    update: { quantity: { increment: item.quantity } },
  });
  return getCart(sessionId);
}`,
  },
  {
    id: "lib-orders",
    path: "lib/orders.ts",
    category: "utility",
    layer: 6,
    col: 2.5,
    exports: ["createOrder"],
    imports: [
      { target: "lib-cart", kind: "import", symbols: ["getCart"] },
      { target: "lib-database", kind: "import", symbols: ["db"] },
      { target: "types-order", kind: "type", symbols: ["Order", "CheckoutInput"] },
    ],
    complexity: 17,
    loc: 141,
    aliases: ["orders service", "order service", "orders lib", "order creation"],
    description: "Creates orders transactionally from the current cart.",
    summary: "Turns a cart into an order, all in one database transaction so nothing is half-saved.",
    body: `export async function createOrder(sessionId: string, input: CheckoutInput): Promise<Order> {
  const cart = await getCart(sessionId);

  return db.$transaction(async (tx) => {
    const order = await tx.order.create({ data: toOrder(cart, input) });
    await tx.cartItem.deleteMany({ where: { sessionId } });
    return order;
  });
}`,
  },

  // ── Layer 7 · infrastructure & types ────────────────────────────────────
  {
    id: "lib-config",
    path: "lib/config.ts",
    category: "utility",
    layer: 7,
    col: -2,
    exports: ["siteConfig"],
    imports: [],
    complexity: 1,
    loc: 22,
    aliases: ["config", "configuration", "site config", "settings"],
    description: "Static site configuration: locale, currency, API base URL and cache TTLs.",
    summary: "A list of store-wide settings like currency, language and how long to cache things.",
    body: `export const siteConfig = {
  name: "Acme Store",
  locale: "en-US",
  currency: "USD",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  cacheTtlMs: 60_000,
  debug: process.env.NODE_ENV === "development",
} as const;`,
  },
  {
    id: "lib-database",
    path: "lib/database.ts",
    category: "utility",
    layer: 7,
    col: -0.75,
    exports: ["db"],
    imports: [{ target: "lib-config", kind: "import", symbols: ["siteConfig"] }],
    complexity: 5,
    loc: 34,
    aliases: ["database", "database client", "db client", "the db", "data store"],
    description: "Singleton database client shared by all server-side data modules.",
    summary: "The one connection to the database. Every server module that stores or reads data goes through it.",
    body: `const globalForDb = globalThis as { db?: DatabaseClient };

export const db =
  globalForDb.db ??
  createClient({
    url: process.env.DATABASE_URL,
    log: siteConfig.debug ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForDb.db = db;`,
  },
  {
    id: "types-product",
    path: "types/product.ts",
    category: "type",
    layer: 7,
    col: 1,
    exports: ["Product", "ProductSummary", "ProductFilters", "ProductCategory"],
    imports: [],
    complexity: 1,
    loc: 38,
    aliases: ["product type", "product types", "product model", "product interface"],
    description: "Product domain types shared by client and server.",
    summary: "Describes what a product looks like — its fields and allowed values — so every file agrees on the shape.",
    body: `export type ProductCategory = "apparel" | "footwear" | "accessories";

export interface Product {
  id: string;
  name: string;
  price: number;
  compareAt?: number;
  category: ProductCategory;
  variants: Variant[];
}

export type ProductSummary = Pick<Product, "id" | "name" | "price">;`,
  },
  {
    id: "types-cart",
    path: "types/cart.ts",
    category: "type",
    layer: 7,
    col: 2,
    exports: ["Cart", "CartItem"],
    imports: [{ target: "types-product", kind: "type", symbols: ["Product"] }],
    complexity: 1,
    loc: 21,
    aliases: ["cart type", "cart types", "cart model"],
    description: "Cart and line-item types.",
    summary: "Describes the shape of a cart and the items inside it.",
    body: `export interface CartItem {
  id: string;
  productId: Product["id"];
  quantity: number;
  unitPrice: number;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
}`,
  },
  {
    id: "types-order",
    path: "types/order.ts",
    category: "type",
    layer: 7,
    col: 3,
    exports: ["Order", "CheckoutInput"],
    imports: [{ target: "types-cart", kind: "type", symbols: ["Cart"] }],
    complexity: 1,
    loc: 26,
    aliases: ["order type", "order types", "order model"],
    description: "Order and checkout input types.",
    summary: "Describes what an order and the checkout form data look like.",
    body: `export interface CheckoutInput {
  email: string;
  shipping: Address;
}

export interface Order {
  id: string;
  status: "pending" | "paid" | "failed";
  lines: Cart["items"];
  total: number;
}`,
  },
];
