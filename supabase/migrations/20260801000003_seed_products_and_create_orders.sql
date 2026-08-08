-- Create products table if not exists (in case it wasn't created yet)
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL,
  description text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on products & public read policy
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to products" ON products;
CREATE POLICY "Public read access to products" ON products FOR SELECT USING (true);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  product_id uuid REFERENCES products(id),
  quantity integer NOT NULL DEFAULT 1,
  stripe_checkout_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their orders" ON orders;
CREATE POLICY "Users can view their orders" ON orders FOR SELECT USING (true);

-- Seed products table
INSERT INTO products (name, price, description, image_url) VALUES
('Wireless Earbuds', 49.99, 'High-fidelity audio with active noise cancellation and ergonomic fit.', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80'),
('Notebook Set', 18.50, 'Premium hardcover dot-grid notebook set with acid-free paper.', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=400&q=80'),
('Water Bottle', 24.99, 'Insulated stainless steel water bottle keeps drinks cold for 24h.', 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=400&q=80'),
('Desk Lamp', 34.00, 'Dimmable LED desk lamp with wireless phone charging base.', 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?auto=format&fit=crop&w=400&q=80'),
('Phone Stand', 14.99, 'Adjustable aluminum desktop phone and tablet stand.', 'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&w=400&q=80'),
('Coffee Mug', 12.99, 'Matte ceramic minimalist coffee mug, 12oz capacity.', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80')
ON CONFLICT DO NOTHING;
