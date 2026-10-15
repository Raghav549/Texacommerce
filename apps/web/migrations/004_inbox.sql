CREATE TABLE IF NOT EXISTS tx_messages (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 sender_id BIGINT NOT NULL REFERENCES tx_accounts(id),recipient_id BIGINT NOT NULL REFERENCES tx_accounts(id),
 body TEXT NOT NULL CHECK(char_length(body) BETWEEN 1 AND 2000),
 client_key UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),read_at TIMESTAMPTZ,
 CHECK(sender_id<>recipient_id),UNIQUE(sender_id,client_key)
);
CREATE INDEX IF NOT EXISTS tx_messages_pair_idx ON tx_messages(sender_id,recipient_id,id DESC);
CREATE INDEX IF NOT EXISTS tx_messages_recipient_idx ON tx_messages(recipient_id,id DESC);
CREATE TABLE IF NOT EXISTS tx_notifications (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES tx_accounts(id),actor_id BIGINT REFERENCES tx_accounts(id),
 kind TEXT NOT NULL CHECK(kind IN ('like','comment','follow','order','message')),
 entity_id BIGINT, body TEXT NOT NULL,read_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tx_notifications_user_idx ON tx_notifications(user_id,id DESC);
CREATE OR REPLACE FUNCTION tx_message_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM tx_accounts WHERE id IN (NEW.sender_id,NEW.recipient_id) ORDER BY id FOR SHARE;
 IF NEW.sender_id=NEW.recipient_id OR tx_blocked(NEW.sender_id,NEW.recipient_id)
 OR (SELECT count(*) FROM tx_accounts WHERE id IN (NEW.sender_id,NEW.recipient_id) AND status='active')<>2
 THEN RAISE EXCEPTION 'INTERACTION_UNAVAILABLE';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tx_message_safety ON tx_messages;
CREATE TRIGGER tx_message_safety BEFORE INSERT ON tx_messages FOR EACH ROW EXECUTE FUNCTION tx_message_guard();
CREATE OR REPLACE FUNCTION tx_notify() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recipient BIGINT;actor BIGINT;kind TEXT;entity BIGINT;summary TEXT;
BEGIN
 IF TG_TABLE_NAME='tx_post_likes' THEN SELECT author_id INTO recipient FROM tx_posts WHERE id=NEW.post_id;actor=NEW.user_id;kind='like';entity=NEW.post_id;summary='Someone liked your post.';
 ELSIF TG_TABLE_NAME='tx_comments' THEN SELECT author_id INTO recipient FROM tx_posts WHERE id=NEW.post_id;actor=NEW.user_id;kind='comment';entity=NEW.post_id;summary='A new comment on your post.';
 ELSIF TG_TABLE_NAME='tx_follows' THEN recipient=NEW.following_id;actor=NEW.follower_id;kind='follow';entity=NEW.follower_id;summary='A new person is following you.';
 ELSIF TG_TABLE_NAME='tx_messages' THEN recipient=NEW.recipient_id;actor=NEW.sender_id;kind='message';entity=NEW.sender_id;summary='You have a new message.';
 ELSIF TG_TABLE_NAME='tx_orders' THEN
  kind='order';entity=NEW.id;
  IF TG_OP='INSERT' THEN recipient=NEW.seller_id;actor=NEW.buyer_id;summary='You have a new order.';
  ELSE IF OLD.status=NEW.status THEN RETURN NEW;END IF;recipient=NEW.buyer_id;actor=NEW.seller_id;summary='Order #'||NEW.id::text||' is now '||NEW.status||'.';END IF;
 END IF;
 IF recipient IS NOT NULL AND recipient<>actor AND NOT tx_blocked(recipient,actor) THEN
  INSERT INTO tx_notifications(user_id,actor_id,kind,entity_id,body) VALUES(recipient,actor,kind,entity,summary);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tx_notify_like ON tx_post_likes;
CREATE TRIGGER tx_notify_like AFTER INSERT ON tx_post_likes FOR EACH ROW EXECUTE FUNCTION tx_notify();
DROP TRIGGER IF EXISTS tx_notify_comment ON tx_comments;
CREATE TRIGGER tx_notify_comment AFTER INSERT ON tx_comments FOR EACH ROW EXECUTE FUNCTION tx_notify();
DROP TRIGGER IF EXISTS tx_notify_follow ON tx_follows;
CREATE TRIGGER tx_notify_follow AFTER INSERT ON tx_follows FOR EACH ROW EXECUTE FUNCTION tx_notify();
DROP TRIGGER IF EXISTS tx_notify_message ON tx_messages;
CREATE TRIGGER tx_notify_message AFTER INSERT ON tx_messages FOR EACH ROW EXECUTE FUNCTION tx_notify();
DROP TRIGGER IF EXISTS tx_notify_order ON tx_orders;
CREATE TRIGGER tx_notify_order AFTER INSERT OR UPDATE OF status ON tx_orders FOR EACH ROW EXECUTE FUNCTION tx_notify();
-- Erase private communications when an account is anonymized; retain financial snapshots only.
CREATE OR REPLACE FUNCTION tx_erase_private_data() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='deleted' AND OLD.status<>'deleted' THEN
  DELETE FROM tx_messages WHERE sender_id=NEW.id OR recipient_id=NEW.id;
  DELETE FROM tx_notifications WHERE user_id=NEW.id OR actor_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tx_account_private_erase ON tx_accounts;
CREATE TRIGGER tx_account_private_erase AFTER UPDATE OF status ON tx_accounts FOR EACH ROW EXECUTE FUNCTION tx_erase_private_data();
