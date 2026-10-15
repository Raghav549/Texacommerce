ALTER TABLE tx_accounts ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '' CHECK(char_length(bio)<=500);
ALTER TABLE tx_accounts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','deleted'));
ALTER TABLE tx_accounts ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin'));
ALTER TABLE tx_accounts ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tx_posts ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tx_comments ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tx_products ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS tx_blocks (
 blocker_id BIGINT NOT NULL REFERENCES tx_accounts(id), blocked_id BIGINT NOT NULL REFERENCES tx_accounts(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(blocker_id,blocked_id), CHECK(blocker_id<>blocked_id)
);
CREATE TABLE IF NOT EXISTS tx_reports (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 reporter_id BIGINT NOT NULL REFERENCES tx_accounts(id),
 kind TEXT NOT NULL CHECK(kind IN ('post','comment','product','account')),
 target_id BIGINT NOT NULL,
 reason TEXT NOT NULL CHECK(char_length(reason) BETWEEN 5 AND 1000),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), reviewed_at TIMESTAMPTZ,
 UNIQUE(reporter_id,kind,target_id)
);
CREATE TABLE IF NOT EXISTS tx_moderation_audit (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id BIGINT NOT NULL REFERENCES tx_accounts(id), report_id BIGINT NOT NULL REFERENCES tx_reports(id),
 action TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tx_reports_queue_idx ON tx_reports(status,created_at);
CREATE TABLE IF NOT EXISTS tx_password_tokens (
 token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES tx_accounts(id),
 expires_at TIMESTAMPTZ NOT NULL, used BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS tx_password_tokens_user_idx ON tx_password_tokens(user_id);
CREATE OR REPLACE FUNCTION tx_blocked(a BIGINT,b BIGINT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM tx_blocks WHERE (blocker_id=a AND blocked_id=b) OR (blocker_id=b AND blocked_id=a))
$$;
CREATE OR REPLACE FUNCTION tx_visible_post(p_post BIGINT,p_viewer BIGINT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM tx_posts p JOIN tx_accounts a ON a.id=p.author_id WHERE p.id=p_post AND NOT p.hidden AND a.status='active' AND NOT tx_blocked(p_viewer,p.author_id))
$$;
CREATE OR REPLACE FUNCTION tx_enforce_social() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor BIGINT; target BIGINT;
BEGIN
 IF TG_TABLE_NAME='tx_follows' THEN actor=NEW.follower_id;target=NEW.following_id;
 ELSE actor=NEW.user_id;SELECT author_id INTO target FROM tx_posts WHERE id=NEW.post_id AND NOT hidden;END IF;
 IF NOT EXISTS(SELECT 1 FROM tx_accounts WHERE id=actor AND status='active')
 OR NOT EXISTS(SELECT 1 FROM tx_accounts WHERE id=target AND status='active') OR tx_blocked(actor,target)
 THEN RAISE EXCEPTION 'INTERACTION_UNAVAILABLE'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tx_social_like_guard ON tx_post_likes;
CREATE TRIGGER tx_social_like_guard BEFORE INSERT ON tx_post_likes FOR EACH ROW EXECUTE FUNCTION tx_enforce_social();
DROP TRIGGER IF EXISTS tx_social_comment_guard ON tx_comments;
CREATE TRIGGER tx_social_comment_guard BEFORE INSERT ON tx_comments FOR EACH ROW EXECUTE FUNCTION tx_enforce_social();
DROP TRIGGER IF EXISTS tx_social_follow_guard ON tx_follows;
CREATE TRIGGER tx_social_follow_guard BEFORE INSERT ON tx_follows FOR EACH ROW EXECUTE FUNCTION tx_enforce_social();
CREATE OR REPLACE FUNCTION tx_block(p_actor BIGINT,p_target BIGINT,p_enabled BOOLEAN) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
 IF p_actor=p_target OR NOT EXISTS(SELECT 1 FROM tx_accounts WHERE id=p_target AND status='active') THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND';END IF;
 IF p_enabled THEN
  INSERT INTO tx_blocks(blocker_id,blocked_id) VALUES(p_actor,p_target) ON CONFLICT DO NOTHING;
  DELETE FROM tx_follows WHERE (follower_id=p_actor AND following_id=p_target) OR (follower_id=p_target AND following_id=p_actor);
 ELSE DELETE FROM tx_blocks WHERE blocker_id=p_actor AND blocked_id=p_target;END IF;
END $$;
CREATE OR REPLACE FUNCTION tx_moderate(p_actor BIGINT,p_report BIGINT,p_action TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE report tx_reports%ROWTYPE; target BIGINT; previous_action TEXT;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM tx_accounts WHERE id=p_actor AND status='active' AND role='admin') THEN RAISE EXCEPTION 'ADMIN_REQUIRED';END IF;
 SELECT * INTO report FROM tx_reports WHERE id=p_report FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND';END IF;
 IF p_action='restore' THEN
  SELECT action INTO previous_action FROM tx_moderation_audit WHERE report_id=p_report ORDER BY id DESC LIMIT 1;
  IF previous_action='restore' THEN RETURN;END IF;
  IF report.status<>'resolved' OR previous_action NOT IN ('hide','suspend') THEN RAISE EXCEPTION 'INVALID_MODERATION_ACTION';END IF;
  IF previous_action='hide' THEN
   IF report.kind='post' THEN UPDATE tx_posts SET hidden=false WHERE id=report.target_id;
   ELSIF report.kind='comment' THEN UPDATE tx_comments SET hidden=false WHERE id=report.target_id;
   ELSIF report.kind='product' THEN UPDATE tx_products SET hidden=false,version=version+1 WHERE id=report.target_id;END IF;
  ELSE
   IF report.kind='account' THEN target=report.target_id;
   ELSIF report.kind='post' THEN SELECT author_id INTO target FROM tx_posts WHERE id=report.target_id;
   ELSIF report.kind='comment' THEN SELECT user_id INTO target FROM tx_comments WHERE id=report.target_id;
   ELSE SELECT seller_id INTO target FROM tx_products WHERE id=report.target_id;END IF;
   UPDATE tx_accounts SET status='active',session_version=session_version+1 WHERE id=target AND status='suspended' AND role='member';
   IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_MODERATION_ACTION';END IF;
  END IF;
  INSERT INTO tx_moderation_audit(actor_id,report_id,action) VALUES(p_actor,p_report,'restore');RETURN;
 END IF;
 IF report.status<>'open' THEN RETURN;END IF;
 IF p_action='hide' THEN
  IF report.kind='post' THEN UPDATE tx_posts SET hidden=true WHERE id=report.target_id;
  ELSIF report.kind='comment' THEN UPDATE tx_comments SET hidden=true WHERE id=report.target_id;
  ELSIF report.kind='product' THEN UPDATE tx_products SET hidden=true,version=version+1 WHERE id=report.target_id;
  ELSE RAISE EXCEPTION 'INVALID_MODERATION_ACTION';END IF;
 ELSIF p_action='suspend' THEN
  IF report.kind='account' THEN target=report.target_id;
  ELSIF report.kind='post' THEN SELECT author_id INTO target FROM tx_posts WHERE id=report.target_id;
  ELSIF report.kind='comment' THEN SELECT user_id INTO target FROM tx_comments WHERE id=report.target_id;
  ELSE SELECT seller_id INTO target FROM tx_products WHERE id=report.target_id;END IF;
  IF NOT EXISTS(SELECT 1 FROM tx_accounts WHERE id=target AND role='member' AND status<>'deleted') THEN RAISE EXCEPTION 'INVALID_MODERATION_ACTION';END IF;
  UPDATE tx_accounts SET status='suspended',session_version=session_version+1 WHERE id=target;
 ELSIF p_action<>'dismiss' THEN RAISE EXCEPTION 'INVALID_MODERATION_ACTION';END IF;
 UPDATE tx_reports SET status=CASE WHEN p_action='dismiss' THEN 'dismissed' ELSE 'resolved' END,reviewed_at=now() WHERE id=p_report;
 INSERT INTO tx_moderation_audit(actor_id,report_id,action) VALUES(p_actor,p_report,p_action);
END $$;
CREATE OR REPLACE FUNCTION tx_reset_password(p_hash TEXT,p_password TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE who BIGINT;
BEGIN
 SELECT user_id INTO who FROM tx_password_tokens WHERE token_hash=p_hash;
 IF NOT FOUND THEN RAISE EXCEPTION 'TOKEN_INVALID';END IF;
 PERFORM 1 FROM tx_accounts WHERE id=who AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TOKEN_INVALID';END IF;
 PERFORM 1 FROM tx_password_tokens WHERE token_hash=p_hash AND NOT used AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TOKEN_INVALID';END IF;
 UPDATE tx_accounts SET password_hash=p_password,session_version=session_version+1 WHERE id=who AND status='active';
 IF NOT FOUND THEN RAISE EXCEPTION 'TOKEN_INVALID';END IF;
 UPDATE tx_password_tokens SET used=true WHERE user_id=who;
END $$;
CREATE OR REPLACE FUNCTION tx_delete_account(p_user BIGINT,p_version INTEGER) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(p_user);
 PERFORM 1 FROM tx_accounts WHERE id=p_user AND status='active' AND session_version=p_version FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND';END IF;
 IF EXISTS(SELECT 1 FROM tx_orders WHERE (buyer_id=p_user OR seller_id=p_user) AND status NOT IN ('delivered','cancelled')) THEN RAISE EXCEPTION 'OPEN_ORDERS';END IF;
 IF EXISTS(SELECT 1 FROM tx_accounts WHERE id=p_user AND role='admin') THEN RAISE EXCEPTION 'ADMIN_DELETE_REQUIRES_TRANSFER';END IF;
 UPDATE tx_accounts SET name='Deleted member',email='deleted-'||id::text||'@deleted.invalid',bio='',password_hash='disabled',status='deleted',session_version=session_version+1 WHERE id=p_user;
 DELETE FROM tx_posts WHERE author_id=p_user;
 DELETE FROM tx_comments WHERE user_id=p_user;
 DELETE FROM tx_post_likes WHERE user_id=p_user;
 DELETE FROM tx_follows WHERE follower_id=p_user OR following_id=p_user;
 DELETE FROM tx_cart WHERE user_id=p_user;
 DELETE FROM tx_password_tokens WHERE user_id=p_user;
 UPDATE tx_products SET active=false,hidden=true,name='Removed listing',description='Removed by account owner.',version=version+1 WHERE seller_id=p_user;
 -- Completed order financial snapshots remain; delivery personal data is scrubbed.
 UPDATE tx_orders SET shipping='{"name":"Deleted member","address":"Removed","phone":"Removed","postal":"Removed"}'::jsonb WHERE buyer_id=p_user;
END $$;
-- Revalidate safety at database write time, not only when the UI loaded.
CREATE OR REPLACE FUNCTION tx_guard_commerce() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE seller BIGINT; buyer BIGINT; product BIGINT;
BEGIN
 IF TG_TABLE_NAME='tx_orders' THEN seller=NEW.seller_id;buyer=NEW.buyer_id;
 ELSIF TG_TABLE_NAME='tx_order_items' THEN
  SELECT buyer_id,seller_id INTO buyer,seller FROM tx_orders WHERE id=NEW.order_id;product=NEW.product_id;
 ELSE buyer=NEW.user_id;product=NEW.product_id;SELECT seller_id INTO seller FROM tx_products WHERE id=product;END IF;
 PERFORM 1 FROM tx_accounts WHERE id IN (buyer,seller) ORDER BY id FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM tx_accounts WHERE id=seller AND status='active') OR NOT EXISTS(SELECT 1 FROM tx_accounts WHERE id=buyer AND status='active') OR tx_blocked(buyer,seller)
 THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE';END IF;
 IF product IS NOT NULL AND NOT EXISTS(SELECT 1 FROM tx_products WHERE id=product AND NOT hidden AND active) THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tx_order_safety ON tx_orders;
CREATE TRIGGER tx_order_safety BEFORE INSERT ON tx_orders FOR EACH ROW EXECUTE FUNCTION tx_guard_commerce();
DROP TRIGGER IF EXISTS tx_item_safety ON tx_order_items;
CREATE TRIGGER tx_item_safety BEFORE INSERT ON tx_order_items FOR EACH ROW EXECUTE FUNCTION tx_guard_commerce();
DROP TRIGGER IF EXISTS tx_cart_safety ON tx_cart;
CREATE TRIGGER tx_cart_safety BEFORE INSERT OR UPDATE ON tx_cart FOR EACH ROW EXECUTE FUNCTION tx_guard_commerce();
CREATE OR REPLACE FUNCTION tx_content_author_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE who BIGINT;
BEGIN
 IF TG_TABLE_NAME='tx_posts' THEN who=NEW.author_id;ELSE who=NEW.seller_id;END IF;
 PERFORM 1 FROM tx_accounts WHERE id=who FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM tx_accounts WHERE id=who AND status='active') THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tx_post_author_safety ON tx_posts;
CREATE TRIGGER tx_post_author_safety BEFORE INSERT ON tx_posts FOR EACH ROW EXECUTE FUNCTION tx_content_author_guard();
DROP TRIGGER IF EXISTS tx_product_author_safety ON tx_products;
CREATE TRIGGER tx_product_author_safety BEFORE INSERT ON tx_products FOR EACH ROW EXECUTE FUNCTION tx_content_author_guard();

CREATE OR REPLACE FUNCTION tx_change_password(p_user BIGINT,p_version INTEGER,p_previous TEXT,p_next TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
 UPDATE tx_accounts SET password_hash=p_next,session_version=session_version+1 WHERE id=p_user AND status='active' AND session_version=p_version AND password_hash=p_previous;
 IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_CHANGED';END IF;
 DELETE FROM tx_password_tokens WHERE user_id=p_user;
END $$;
