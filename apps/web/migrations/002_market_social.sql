CREATE TABLE IF NOT EXISTS tx_products (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 seller_id BIGINT NOT NULL REFERENCES tx_accounts(id),
 name TEXT NOT NULL CHECK(char_length(name) BETWEEN 3 AND 120),
 description TEXT NOT NULL CHECK(char_length(description) BETWEEN 10 AND 3000),
 price_paise INTEGER NOT NULL CHECK(price_paise BETWEEN 100 AND 100000000),
 stock INTEGER NOT NULL CHECK(stock >= 0),
 category TEXT NOT NULL CHECK(category IN ('Accessories','Fashion','Home & living','Art','Other')),
 artwork INTEGER NOT NULL DEFAULT 0 CHECK(artwork BETWEEN 0 AND 2),
 active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE tx_products ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS tx_cart (
 user_id BIGINT NOT NULL REFERENCES tx_accounts(id) ON DELETE CASCADE,
 product_id BIGINT NOT NULL REFERENCES tx_products(id),
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20),
 PRIMARY KEY(user_id,product_id)
);
CREATE TABLE IF NOT EXISTS tx_checkouts (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 buyer_id BIGINT NOT NULL REFERENCES tx_accounts(id),
 request_key UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(buyer_id,request_key)
);
CREATE TABLE IF NOT EXISTS tx_orders (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 checkout_id BIGINT NOT NULL REFERENCES tx_checkouts(id),
 buyer_id BIGINT NOT NULL REFERENCES tx_accounts(id),
 seller_id BIGINT NOT NULL REFERENCES tx_accounts(id),
 total_paise BIGINT NOT NULL CHECK(total_paise > 0),
 shipping JSONB NOT NULL,
 payment_method TEXT NOT NULL DEFAULT 'COD' CHECK(payment_method = 'COD'),
 status TEXT NOT NULL DEFAULT 'placed' CHECK(status IN ('placed','accepted','shipped','delivered','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tx_order_items (
 order_id BIGINT NOT NULL REFERENCES tx_orders(id),
 product_id BIGINT NOT NULL REFERENCES tx_products(id),
 name TEXT NOT NULL,
 unit_paise INTEGER NOT NULL CHECK(unit_paise > 0),
 quantity INTEGER NOT NULL CHECK(quantity > 0),
 PRIMARY KEY(order_id,product_id)
);
CREATE INDEX IF NOT EXISTS tx_orders_buyer_idx ON tx_orders(buyer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS tx_orders_seller_idx ON tx_orders(seller_id,created_at DESC);
CREATE INDEX IF NOT EXISTS tx_products_catalog_idx ON tx_products(active,created_at DESC);
CREATE TABLE IF NOT EXISTS tx_post_likes (
 post_id BIGINT NOT NULL REFERENCES tx_posts(id) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES tx_accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(post_id,user_id)
);
CREATE TABLE IF NOT EXISTS tx_follows (
 follower_id BIGINT NOT NULL REFERENCES tx_accounts(id) ON DELETE CASCADE,
 following_id BIGINT NOT NULL REFERENCES tx_accounts(id) ON DELETE CASCADE,
 PRIMARY KEY(follower_id,following_id), CHECK(follower_id <> following_id)
);
CREATE TABLE IF NOT EXISTS tx_comments (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 post_id BIGINT NOT NULL REFERENCES tx_posts(id) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES tx_accounts(id) ON DELETE CASCADE,
 body TEXT NOT NULL CHECK(char_length(body) BETWEEN 1 AND 1000),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tx_comments_post_idx ON tx_comments(post_id,created_at);

-- All cart writers and checkouts serialize on the buyer's transaction-level lock.
CREATE OR REPLACE FUNCTION tx_set_cart(p_user BIGINT,p_product BIGINT,p_quantity INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE item tx_products%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(p_user);
 IF p_quantity < 0 OR p_quantity > 20 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
 IF p_quantity = 0 THEN DELETE FROM tx_cart WHERE user_id=p_user AND product_id=p_product; RETURN; END IF;
 SELECT * INTO item FROM tx_products WHERE id=p_product FOR UPDATE;
 IF NOT FOUND OR NOT item.active THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
 IF item.seller_id=p_user THEN RAISE EXCEPTION 'OWN_PRODUCT'; END IF;
 IF item.stock < p_quantity THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
 INSERT INTO tx_cart(user_id,product_id,quantity) VALUES(p_user,p_product,p_quantity)
 ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity;
END $$;

CREATE OR REPLACE FUNCTION tx_checkout(p_buyer BIGINT,p_key UUID,p_shipping JSONB,p_expected JSONB)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE checkout_id BIGINT; row_item RECORD; seller RECORD; new_order BIGINT;
BEGIN
 PERFORM pg_advisory_xact_lock(p_buyer);
 SELECT id INTO checkout_id FROM tx_checkouts WHERE buyer_id=p_buyer AND request_key=p_key;
 IF FOUND THEN RETURN checkout_id; END IF;
 IF NOT EXISTS(SELECT 1 FROM tx_cart WHERE user_id=p_buyer) THEN RAISE EXCEPTION 'EMPTY_CART'; END IF;
 IF (SELECT count(*) FROM tx_cart WHERE user_id=p_buyer)>50 THEN RAISE EXCEPTION 'CART_TOO_LARGE'; END IF;
 IF p_shipping IS NULL OR jsonb_typeof(p_shipping)<>'object'
 OR length(trim(coalesce(p_shipping->>'name',''))) NOT BETWEEN 2 AND 100
 OR length(trim(coalesce(p_shipping->>'address',''))) NOT BETWEEN 10 AND 500
 OR coalesce(p_shipping->>'phone','') !~ '^[0-9+ ()-]{8,20}$'
 OR coalesce(p_shipping->>'postal','') !~ '^[0-9]{6}$'
 THEN RAISE EXCEPTION 'INVALID_SHIPPING'; END IF;
 -- Global product lock order prevents deadlocks between buyers.
 FOR row_item IN SELECT p.*,c.quantity FROM tx_cart c JOIN tx_products p ON p.id=c.product_id WHERE c.user_id=p_buyer ORDER BY p.id FOR UPDATE OF p LOOP
  IF NOT row_item.active OR row_item.seller_id=p_buyer THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
  IF row_item.stock<row_item.quantity THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK'; END IF;
 END LOOP;
 -- Verify that the customer explicitly accepted these quantities and prices.
 IF p_expected IS NULL OR jsonb_typeof(p_expected)<>'array' THEN RAISE EXCEPTION 'CART_CHANGED'; END IF;
 IF jsonb_array_length(p_expected)<>(SELECT count(*) FROM tx_cart WHERE user_id=p_buyer)
 OR EXISTS(SELECT 1 FROM tx_cart c JOIN tx_products p ON p.id=c.product_id
   WHERE c.user_id=p_buyer AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_expected) e
    WHERE e->>'productId'=p.id::text AND (e->>'quantity')::integer=c.quantity AND (e->>'unit_paise')::integer=p.price_paise))
 THEN RAISE EXCEPTION 'CART_CHANGED'; END IF;
 INSERT INTO tx_checkouts(buyer_id,request_key) VALUES(p_buyer,p_key) RETURNING id INTO checkout_id;
 FOR seller IN SELECT p.seller_id,sum(p.price_paise::BIGINT*c.quantity) AS total FROM tx_cart c JOIN tx_products p ON p.id=c.product_id WHERE c.user_id=p_buyer GROUP BY p.seller_id LOOP
  INSERT INTO tx_orders(checkout_id,buyer_id,seller_id,total_paise,shipping) VALUES(checkout_id,p_buyer,seller.seller_id,seller.total,p_shipping) RETURNING id INTO new_order;
  INSERT INTO tx_order_items(order_id,product_id,name,unit_paise,quantity)
  SELECT new_order,p.id,p.name,p.price_paise,c.quantity FROM tx_cart c JOIN tx_products p ON p.id=c.product_id WHERE c.user_id=p_buyer AND p.seller_id=seller.seller_id;
 END LOOP;
 UPDATE tx_products p SET stock=p.stock-c.quantity,version=p.version+1 FROM tx_cart c WHERE c.product_id=p.id AND c.user_id=p_buyer;
 DELETE FROM tx_cart WHERE user_id=p_buyer;
 RETURN checkout_id;
END $$;

CREATE OR REPLACE FUNCTION tx_order_status(p_actor BIGINT,p_order BIGINT,p_status TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE item tx_orders%ROWTYPE;
BEGIN
 SELECT * INTO item FROM tx_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR (item.buyer_id<>p_actor AND item.seller_id<>p_actor) THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF item.status=p_status THEN RETURN; END IF;
 IF p_status='cancelled' AND item.status IN ('placed','accepted') THEN
  -- Buyer/seller may cancel before shipping. Stock is restored once, atomically.
  PERFORM 1 FROM tx_products p JOIN tx_order_items oi ON oi.product_id=p.id WHERE oi.order_id=p_order ORDER BY p.id FOR UPDATE OF p;
  UPDATE tx_products p SET stock=p.stock+oi.quantity,version=p.version+1 FROM tx_order_items oi WHERE oi.product_id=p.id AND oi.order_id=p_order;
 ELSIF item.seller_id=p_actor AND ((item.status='placed' AND p_status='accepted') OR (item.status='accepted' AND p_status='shipped')) THEN
  NULL;
 ELSIF item.buyer_id=p_actor AND item.status='shipped' AND p_status='delivered' THEN
  NULL;
 ELSE RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
 UPDATE tx_orders SET status=p_status,updated_at=now() WHERE id=p_order;
END $$;
