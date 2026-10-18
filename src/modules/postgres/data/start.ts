// Recorded on PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2) (postgres:18 image) by tools/postgres-capture/capture-start.mjs — do not edit by hand.
// Lessons: Install and configure, Using PostgreSQL day to day, Schema design and data types.

export const START = {
  "version": "18.6 (Debian 18.6-1.pgdg13+2)",
  "setup": {
    "contexts": [
      {
        "context": "user",
        "n": 151
      },
      {
        "context": "sighup",
        "n": 104
      },
      {
        "context": "postmaster",
        "n": 69
      },
      {
        "context": "superuser",
        "n": 49
      },
      {
        "context": "internal",
        "n": 20
      },
      {
        "context": "superuser-backend",
        "n": 4
      },
      {
        "context": "backend",
        "n": 2
      }
    ],
    "settings": [
      {
        "name": "listen_addresses",
        "context": "postmaster"
      },
      {
        "name": "port",
        "context": "postmaster"
      },
      {
        "name": "max_connections",
        "context": "postmaster"
      },
      {
        "name": "shared_buffers",
        "context": "postmaster"
      },
      {
        "name": "effective_cache_size",
        "context": "user"
      },
      {
        "name": "work_mem",
        "context": "user"
      },
      {
        "name": "maintenance_work_mem",
        "context": "user"
      },
      {
        "name": "wal_level",
        "context": "postmaster"
      },
      {
        "name": "max_wal_size",
        "context": "sighup"
      },
      {
        "name": "io_method",
        "context": "postmaster"
      },
      {
        "name": "idle_in_transaction_session_timeout",
        "context": "user"
      },
      {
        "name": "lock_timeout",
        "context": "user"
      },
      {
        "name": "statement_timeout",
        "context": "user"
      },
      {
        "name": "log_min_duration_statement",
        "context": "superuser"
      },
      {
        "name": "log_lock_waits",
        "context": "superuser"
      },
      {
        "name": "log_connections",
        "context": "superuser-backend"
      },
      {
        "name": "password_encryption",
        "context": "user"
      },
      {
        "name": "ssl",
        "context": "sighup"
      }
    ],
    "checksums": "on",
    "sessionSet": "lab=# SET work_mem = '64MB';\nSET\n\nlab=# SHOW work_mem;\n work_mem \n----------\n 64MB\n(1 row)\n\nlab=# SET shared_buffers = '1GB';\nERROR:  parameter \"shared_buffers\" cannot be changed without restarting the server\n\nlab=# SELECT name, setting, unit, context FROM pg_settings WHERE name IN ('work_mem', 'shared_buffers');\n      name      | setting | unit |  context   \n----------------+---------+------+------------\n shared_buffers | 16384   | 8kB  | postmaster\n work_mem       | 65536   | kB   | user\n(2 rows)"
  },
  "using": {
    "connect": "$ psql -h localhost -U app -d shop -c 'SELECT current_user'        # no password available\nPassword for user app: \npsql: error: connection to server at \"localhost\" (::1), port 5432 failed: fe_sendauth: no password supplied\n\n$ PGPASSWORD=app-secret psql -h localhost -p 5432 -U app -d shop -c 'SELECT current_user, current_database()'\n current_user | current_database \n--------------+------------------\n app          | shop\n(1 row)\n\n$ psql \"postgresql://app:app-secret@localhost:5432/shop?sslmode=disable\" -c 'SELECT version()'\n                                                      version                                                       \n--------------------------------------------------------------------------------------------------------------------\n PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit\n(1 row)",
    "pgpass": "$ echo 'localhost:5432:shop:app:app-secret' > ~/.pgpass && chmod 600 ~/.pgpass\n\n$ export PGHOST=localhost PGUSER=app PGDATABASE=shop\n$ psql -c '\\conninfo'\n      Connection Information\n      Parameter       |   Value   \n----------------------+-----------\n Database             | shop\n Client User          | app\n Host                 | localhost\n Host Address         | ::1\n Server Port          | 5432\n Options              | \n Protocol Version     | 3.0\n Password Used        | true\n GSSAPI Authenticated | false\n Backend PID          | 406\n SSL Connection       | false\n Superuser            | off\n Hot Standby          | off\n(13 rows)",
    "create": "shop=> CREATE TABLE customers (\n         id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n         name  text NOT NULL,\n         email text NOT NULL UNIQUE,\n         city  text NOT NULL\n       );\nCREATE TABLE\n\nshop=> CREATE TABLE products (\n         id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n         name  text NOT NULL UNIQUE,\n         price numeric(10,2) NOT NULL CHECK (price >= 0)\n       );\nCREATE TABLE\n\nshop=> CREATE TABLE orders (\n         id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n         customer_id bigint NOT NULL REFERENCES customers (id),\n         product_id  bigint NOT NULL REFERENCES products (id),\n         quantity    int NOT NULL CHECK (quantity > 0),\n         amount      numeric(10,2) NOT NULL,\n         status      text NOT NULL DEFAULT 'new',\n         created_at  timestamptz NOT NULL DEFAULT now()\n       );\nCREATE TABLE\n\nshop=> CREATE INDEX ON orders (customer_id);\nCREATE INDEX",
    "insert": "shop=> INSERT INTO customers (name, email, city) VALUES\n         ('Ann', 'ann@example.com', 'Lisbon'),\n         ('Ben', 'ben@example.com', 'Oslo'),\n         ('Cara', 'cara@example.com', 'Lisbon'),\n         ('Dev', 'dev@example.com', 'Porto')\n       RETURNING id, name;\n id | name \n----+------\n  1 | Ann\n  2 | Ben\n  3 | Cara\n  4 | Dev\n(4 rows)\n\nINSERT 0 4\n\nshop=> INSERT INTO products (name, price)\n       VALUES ('Keyboard', 45.00), ('Mouse', 20.00), ('Monitor', 180.00), ('Cable', 8.50)\n       RETURNING *;\n id |   name   | price  \n----+----------+--------\n  1 | Keyboard |  45.00\n  2 | Mouse    |  20.00\n  3 | Monitor  | 180.00\n  4 | Cable    |   8.50\n(4 rows)\n\nINSERT 0 4\n\nshop=> INSERT INTO orders (customer_id, product_id, quantity, amount, status) VALUES\n         (1, 1, 1, 45.00, 'paid'),\n         (1, 4, 2, 17.00, 'paid'),\n         (2, 3, 1, 180.00, 'shipped'),\n         (3, 2, 2, 40.00, 'new'),\n         (2, 2, 1, 20.00, 'paid'),\n         (1, 3, 1, 180.00, 'new'),\n         (3, 1, 2, 90.00, 'paid')\n       RETURNING id, amount, status;\n id | amount | status  \n----+--------+---------\n  1 |  45.00 | paid\n  2 |  17.00 | paid\n  3 | 180.00 | shipped\n  4 |  40.00 | new\n  5 |  20.00 | paid\n  6 | 180.00 | new\n  7 |  90.00 | paid\n(7 rows)\n\nINSERT 0 7",
    "meta": "shop=> \\dt\n           List of tables\n Schema |   Name    | Type  | Owner \n--------+-----------+-------+-------\n public | customers | table | app\n public | orders    | table | app\n public | products  | table | app\n(3 rows)\n\nshop=> \\d orders\n                                    Table \"public.orders\"\n   Column    |           Type           | Collation | Nullable |           Default            \n-------------+--------------------------+-----------+----------+------------------------------\n id          | bigint                   |           | not null | generated always as identity\n customer_id | bigint                   |           | not null | \n product_id  | bigint                   |           | not null | \n quantity    | integer                  |           | not null | \n amount      | numeric(10,2)            |           | not null | \n status      | text                     |           | not null | 'new'::text\n created_at  | timestamp with time zone |           | not null | now()\nIndexes:\n    \"orders_pkey\" PRIMARY KEY, btree (id)\n    \"orders_customer_id_idx\" btree (customer_id)\nCheck constraints:\n    \"orders_quantity_check\" CHECK (quantity > 0)\nForeign-key constraints:\n    \"orders_customer_id_fkey\" FOREIGN KEY (customer_id) REFERENCES customers(id)\n    \"orders_product_id_fkey\" FOREIGN KEY (product_id) REFERENCES products(id)",
    "expanded": "shop=> \\x on\nExpanded display is on.\n\nshop=> SELECT * FROM orders WHERE id = 3;\n-[ RECORD 1 ]------------------------------\nid          | 3\ncustomer_id | 2\nproduct_id  | 3\nquantity    | 1\namount      | 180.00\nstatus      | shipped\ncreated_at  | 2026-10-18 08:10:28.801462+00\n\nshop=> \\x off\nExpanded display is off.\n\nshop=> \\timing on\nTiming is on.\n\nshop=> SELECT count(*) FROM orders;\n count \n-------\n     7\n(1 row)\n\nTime: 0.162 ms\n\nshop=> \\timing off\nTiming is off.",
    "select": "shop=> SELECT id, name, city FROM customers WHERE city = 'Lisbon' ORDER BY name;\n id | name |  city  \n----+------+--------\n  1 | Ann  | Lisbon\n  3 | Cara | Lisbon\n(2 rows)\n\nshop=> SELECT id, customer_id, amount\n       FROM orders\n       WHERE status = 'paid' AND amount > 20\n       ORDER BY amount DESC\n       LIMIT 2;\n id | customer_id | amount \n----+-------------+--------\n  7 |           3 |  90.00\n  1 |           1 |  45.00\n(2 rows)\n\nshop=> SELECT name, price FROM products WHERE name ILIKE 'm%' OR price < 10;\n  name   | price  \n---------+--------\n Mouse   |  20.00\n Monitor | 180.00\n Cable   |   8.50\n(3 rows)",
    "update": "shop=> UPDATE customers SET city = 'Bergen' WHERE email = 'ben@example.com' RETURNING *;\n id | name |      email      |  city  \n----+------+-----------------+--------\n  2 | Ben  | ben@example.com | Bergen\n(1 row)\n\nUPDATE 1\n\nshop=> UPDATE products SET price = price * 1.10 WHERE name = 'Cable' RETURNING name, price;\n name  | price \n-------+-------\n Cable |  9.35\n(1 row)\n\nUPDATE 1\n\nshop=> UPDATE products SET price = price * 1.10;\nUPDATE 4",
    "delete": "shop=> DELETE FROM customers WHERE id = 1;\nERROR:  update or delete on table \"customers\" violates foreign key constraint \"orders_customer_id_fkey\" on table \"orders\"\nDETAIL:  Key (id)=(1) is still referenced from table \"orders\".\n\nshop=> DELETE FROM customers WHERE email = 'nobody@example.com';\nDELETE 0",
    "join": "shop=> SELECT c.name, o.id AS order_id, p.name AS product, o.quantity, o.amount\n       FROM orders o\n       JOIN customers c ON c.id = o.customer_id\n       JOIN products p ON p.id = o.product_id\n       ORDER BY o.id;\n name | order_id | product  | quantity | amount \n------+----------+----------+----------+--------\n Ann  |        1 | Keyboard |        1 |  45.00\n Ann  |        2 | Cable    |        2 |  17.00\n Ben  |        3 | Monitor  |        1 | 180.00\n Cara |        4 | Mouse    |        2 |  40.00\n Ben  |        5 | Mouse    |        1 |  20.00\n Ann  |        6 | Monitor  |        1 | 180.00\n Cara |        7 | Keyboard |        2 |  90.00\n(7 rows)\n\nshop=> SELECT c.name, o.id AS order_id\n       FROM customers c\n       LEFT JOIN orders o ON o.customer_id = c.id\n       WHERE o.id IS NULL;\n name | order_id \n------+----------\n Dev  |         \n(1 row)",
    "group": "shop=> SELECT status, count(*) FROM orders GROUP BY status ORDER BY status;\n status  | count \n---------+-------\n new     |     2\n paid    |     4\n shipped |     1\n(3 rows)\n\nshop=> SELECT c.name, count(*) AS orders, sum(o.amount) AS total, round(avg(o.amount), 2) AS average\n       FROM customers c\n       JOIN orders o ON o.customer_id = c.id\n       GROUP BY c.name\n       HAVING sum(o.amount) > 100\n       ORDER BY total DESC;\n name | orders | total  | average \n------+--------+--------+---------\n Ann  |      3 | 242.00 |   80.67\n Ben  |      2 | 200.00 |  100.00\n Cara |      2 | 130.00 |   65.00\n(3 rows)\n\nshop=> SELECT c.name, o.amount FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.name;\nERROR:  column \"o.amount\" must appear in the GROUP BY clause or be used in an aggregate function\nLINE 1: SELECT c.name, o.amount FROM customers c JOIN orders o ON o....\n                       ^",
    "rollback": "shop=> BEGIN;\nBEGIN\n\nshop=*> DELETE FROM orders WHERE status = 'new' RETURNING id;\n id \n----\n  4\n  6\n(2 rows)\n\nDELETE 2\n\nshop=*> SELECT count(*) FROM orders WHERE status = 'new';\n count \n-------\n     0\n(1 row)\n\nshop=*> ROLLBACK;\nROLLBACK\n\nshop=> SELECT count(*) FROM orders WHERE status = 'new';\n count \n-------\n     2\n(1 row)",
    "aborted": "shop=> BEGIN;\nBEGIN\n\nshop=*> INSERT INTO orders (customer_id, product_id, quantity, amount)\n        VALUES (4, 2, 1, 20.00) RETURNING id;\n id \n----\n  8\n(1 row)\n\nINSERT 0 1\n\nshop=*> INSERT INTO orders (customer_id, product_id, quantity, amount)\n        VALUES (4, 99, 1, 20.00);\nERROR:  insert or update on table \"orders\" violates foreign key constraint \"orders_product_id_fkey\"\nDETAIL:  Key (product_id)=(99) is not present in table \"products\".\n\nshop=!> SELECT count(*) FROM orders;\nERROR:  current transaction is aborted, commands ignored until end of transaction block\n\nshop=!> COMMIT;\nROLLBACK\n\nshop=> SELECT count(*) FROM orders WHERE customer_id = 4;\n count \n-------\n     0\n(1 row)",
    "upsert": "shop=> CREATE TABLE stock (\n         product_id bigint PRIMARY KEY REFERENCES products (id),\n         quantity   int NOT NULL\n       );\nCREATE TABLE\n\nshop=> INSERT INTO stock VALUES (1, 10);\nINSERT 0 1\n\nshop=> INSERT INTO stock VALUES (1, 5);\nERROR:  duplicate key value violates unique constraint \"stock_pkey\"\nDETAIL:  Key (product_id)=(1) already exists.\n\nshop=> INSERT INTO stock VALUES (1, 5)\n       ON CONFLICT (product_id) DO UPDATE SET quantity = stock.quantity + EXCLUDED.quantity\n       RETURNING old.quantity AS before, new.quantity AS after;\n before | after \n--------+-------\n     10 |    15\n(1 row)\n\nINSERT 0 1\n\nshop=> INSERT INTO stock VALUES (1, 5) ON CONFLICT DO NOTHING RETURNING *;\n product_id | quantity \n------------+----------\n(0 rows)\n\nINSERT 0 0",
    "copy": "shop=> COPY products (name, price) FROM STDIN WITH (FORMAT csv);\nStand,30.00\nWebcam,55.00\n\\.\nCOPY 2\n\nshop=> \\copy (SELECT id, name, price FROM products ORDER BY id) TO 'products.csv' WITH (FORMAT csv, HEADER)\nCOPY 6\n\nshop=> \\! cat products.csv\nid,name,price\n1,Keyboard,45.00\n2,Mouse,20.00\n3,Monitor,180.00\n4,Cable,8.50\n5,Stand,30.00\n6,Webcam,55.00\n\nshop=> \\! rm products.csv",
    "playground": {
      "SELECT o.id, o.customer_id, o.status, o.amount\nFROM orders o\nORDER BY o.amount DESC, o.id": [
        "3|2|shipped|180.00",
        "6|1|new|180.00",
        "7|3|paid|90.00",
        "1|1|paid|45.00",
        "4|3|new|40.00",
        "5|2|paid|20.00",
        "2|1|paid|17.00"
      ],
      "SELECT o.id, o.customer_id, o.status, o.amount\nFROM orders o\nORDER BY o.amount DESC, o.id\nLIMIT 3": [
        "3|2|shipped|180.00",
        "6|1|new|180.00",
        "7|3|paid|90.00"
      ],
      "SELECT o.id, o.customer_id, o.status, o.amount\nFROM orders o\nORDER BY o.id": [
        "1|1|paid|45.00",
        "2|1|paid|17.00",
        "3|2|shipped|180.00",
        "4|3|new|40.00",
        "5|2|paid|20.00",
        "6|1|new|180.00",
        "7|3|paid|90.00"
      ],
      "SELECT o.id, o.customer_id, o.status, o.amount\nFROM orders o\nORDER BY o.id\nLIMIT 3": [
        "1|1|paid|45.00",
        "2|1|paid|17.00",
        "3|2|shipped|180.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nGROUP BY o.customer_id\nORDER BY total DESC, customer_id": [
        "1|3|242.00",
        "2|2|200.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nGROUP BY o.customer_id\nORDER BY total DESC, customer_id\nLIMIT 3": [
        "1|3|242.00",
        "2|2|200.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nGROUP BY o.customer_id\nORDER BY customer_id": [
        "1|3|242.00",
        "2|2|200.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nGROUP BY o.customer_id\nORDER BY customer_id\nLIMIT 3": [
        "1|3|242.00",
        "2|2|200.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nGROUP BY o.customer_id\nHAVING count(o.id) >= 2\nORDER BY total DESC, customer_id": [
        "1|3|242.00",
        "2|2|200.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nGROUP BY o.customer_id\nHAVING count(o.id) >= 2\nORDER BY total DESC, customer_id\nLIMIT 3": [
        "1|3|242.00",
        "2|2|200.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nGROUP BY o.customer_id\nHAVING count(o.id) >= 2\nORDER BY customer_id": [
        "1|3|242.00",
        "2|2|200.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nGROUP BY o.customer_id\nHAVING count(o.id) >= 2\nORDER BY customer_id\nLIMIT 3": [
        "1|3|242.00",
        "2|2|200.00",
        "3|2|130.00"
      ],
      "SELECT o.id, o.customer_id, o.status, o.amount\nFROM orders o\nWHERE o.status = 'paid'\nORDER BY o.amount DESC, o.id": [
        "7|3|paid|90.00",
        "1|1|paid|45.00",
        "5|2|paid|20.00",
        "2|1|paid|17.00"
      ],
      "SELECT o.id, o.customer_id, o.status, o.amount\nFROM orders o\nWHERE o.status = 'paid'\nORDER BY o.amount DESC, o.id\nLIMIT 3": [
        "7|3|paid|90.00",
        "1|1|paid|45.00",
        "5|2|paid|20.00"
      ],
      "SELECT o.id, o.customer_id, o.status, o.amount\nFROM orders o\nWHERE o.status = 'paid'\nORDER BY o.id": [
        "1|1|paid|45.00",
        "2|1|paid|17.00",
        "5|2|paid|20.00",
        "7|3|paid|90.00"
      ],
      "SELECT o.id, o.customer_id, o.status, o.amount\nFROM orders o\nWHERE o.status = 'paid'\nORDER BY o.id\nLIMIT 3": [
        "1|1|paid|45.00",
        "2|1|paid|17.00",
        "5|2|paid|20.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.status = 'paid'\nGROUP BY o.customer_id\nORDER BY total DESC, customer_id": [
        "3|1|90.00",
        "1|2|62.00",
        "2|1|20.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.status = 'paid'\nGROUP BY o.customer_id\nORDER BY total DESC, customer_id\nLIMIT 3": [
        "3|1|90.00",
        "1|2|62.00",
        "2|1|20.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.status = 'paid'\nGROUP BY o.customer_id\nORDER BY customer_id": [
        "1|2|62.00",
        "2|1|20.00",
        "3|1|90.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.status = 'paid'\nGROUP BY o.customer_id\nORDER BY customer_id\nLIMIT 3": [
        "1|2|62.00",
        "2|1|20.00",
        "3|1|90.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.status = 'paid'\nGROUP BY o.customer_id\nHAVING count(o.id) >= 2\nORDER BY total DESC, customer_id": [
        "1|2|62.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.status = 'paid'\nGROUP BY o.customer_id\nHAVING count(o.id) >= 2\nORDER BY total DESC, customer_id\nLIMIT 3": [
        "1|2|62.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.status = 'paid'\nGROUP BY o.customer_id\nHAVING count(o.id) >= 2\nORDER BY customer_id": [
        "1|2|62.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.status = 'paid'\nGROUP BY o.customer_id\nHAVING count(o.id) >= 2\nORDER BY customer_id\nLIMIT 3": [
        "1|2|62.00"
      ],
      "SELECT o.id, o.customer_id, o.status, o.amount\nFROM orders o\nWHERE o.amount >= 40\nORDER BY o.amount DESC, o.id": [
        "3|2|shipped|180.00",
        "6|1|new|180.00",
        "7|3|paid|90.00",
        "1|1|paid|45.00",
        "4|3|new|40.00"
      ],
      "SELECT o.id, o.customer_id, o.status, o.amount\nFROM orders o\nWHERE o.amount >= 40\nORDER BY o.amount DESC, o.id\nLIMIT 3": [
        "3|2|shipped|180.00",
        "6|1|new|180.00",
        "7|3|paid|90.00"
      ],
      "SELECT o.id, o.customer_id, o.status, o.amount\nFROM orders o\nWHERE o.amount >= 40\nORDER BY o.id": [
        "1|1|paid|45.00",
        "3|2|shipped|180.00",
        "4|3|new|40.00",
        "6|1|new|180.00",
        "7|3|paid|90.00"
      ],
      "SELECT o.id, o.customer_id, o.status, o.amount\nFROM orders o\nWHERE o.amount >= 40\nORDER BY o.id\nLIMIT 3": [
        "1|1|paid|45.00",
        "3|2|shipped|180.00",
        "4|3|new|40.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.amount >= 40\nGROUP BY o.customer_id\nORDER BY total DESC, customer_id": [
        "1|2|225.00",
        "2|1|180.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.amount >= 40\nGROUP BY o.customer_id\nORDER BY total DESC, customer_id\nLIMIT 3": [
        "1|2|225.00",
        "2|1|180.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.amount >= 40\nGROUP BY o.customer_id\nORDER BY customer_id": [
        "1|2|225.00",
        "2|1|180.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.amount >= 40\nGROUP BY o.customer_id\nORDER BY customer_id\nLIMIT 3": [
        "1|2|225.00",
        "2|1|180.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.amount >= 40\nGROUP BY o.customer_id\nHAVING count(o.id) >= 2\nORDER BY total DESC, customer_id": [
        "1|2|225.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.amount >= 40\nGROUP BY o.customer_id\nHAVING count(o.id) >= 2\nORDER BY total DESC, customer_id\nLIMIT 3": [
        "1|2|225.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.amount >= 40\nGROUP BY o.customer_id\nHAVING count(o.id) >= 2\nORDER BY customer_id": [
        "1|2|225.00",
        "3|2|130.00"
      ],
      "SELECT o.customer_id, count(o.id) AS orders, sum(o.amount) AS total\nFROM orders o\nWHERE o.amount >= 40\nGROUP BY o.customer_id\nHAVING count(o.id) >= 2\nORDER BY customer_id\nLIMIT 3": [
        "1|2|225.00",
        "3|2|130.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nORDER BY o.amount DESC, o.id": [
        "Ben|3|shipped|180.00",
        "Ann|6|new|180.00",
        "Cara|7|paid|90.00",
        "Ann|1|paid|45.00",
        "Cara|4|new|40.00",
        "Ben|5|paid|20.00",
        "Ann|2|paid|17.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nORDER BY o.amount DESC, o.id\nLIMIT 3": [
        "Ben|3|shipped|180.00",
        "Ann|6|new|180.00",
        "Cara|7|paid|90.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nORDER BY o.id": [
        "Ann|1|paid|45.00",
        "Ann|2|paid|17.00",
        "Ben|3|shipped|180.00",
        "Cara|4|new|40.00",
        "Ben|5|paid|20.00",
        "Ann|6|new|180.00",
        "Cara|7|paid|90.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nORDER BY o.id\nLIMIT 3": [
        "Ann|1|paid|45.00",
        "Ann|2|paid|17.00",
        "Ben|3|shipped|180.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nORDER BY total DESC, name": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nORDER BY total DESC, name\nLIMIT 3": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nORDER BY name": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nORDER BY name\nLIMIT 3": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY total DESC, name": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY total DESC, name\nLIMIT 3": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY name": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY name\nLIMIT 3": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nORDER BY o.amount DESC, o.id": [
        "Cara|7|paid|90.00",
        "Ann|1|paid|45.00",
        "Ben|5|paid|20.00",
        "Ann|2|paid|17.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nORDER BY o.amount DESC, o.id\nLIMIT 3": [
        "Cara|7|paid|90.00",
        "Ann|1|paid|45.00",
        "Ben|5|paid|20.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nORDER BY o.id": [
        "Ann|1|paid|45.00",
        "Ann|2|paid|17.00",
        "Ben|5|paid|20.00",
        "Cara|7|paid|90.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nORDER BY o.id\nLIMIT 3": [
        "Ann|1|paid|45.00",
        "Ann|2|paid|17.00",
        "Ben|5|paid|20.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nORDER BY total DESC, name": [
        "Cara|1|90.00",
        "Ann|2|62.00",
        "Ben|1|20.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nORDER BY total DESC, name\nLIMIT 3": [
        "Cara|1|90.00",
        "Ann|2|62.00",
        "Ben|1|20.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nORDER BY name": [
        "Ann|2|62.00",
        "Ben|1|20.00",
        "Cara|1|90.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nORDER BY name\nLIMIT 3": [
        "Ann|2|62.00",
        "Ben|1|20.00",
        "Cara|1|90.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY total DESC, name": [
        "Ann|2|62.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY total DESC, name\nLIMIT 3": [
        "Ann|2|62.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY name": [
        "Ann|2|62.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY name\nLIMIT 3": [
        "Ann|2|62.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nORDER BY o.amount DESC, o.id": [
        "Ben|3|shipped|180.00",
        "Ann|6|new|180.00",
        "Cara|7|paid|90.00",
        "Ann|1|paid|45.00",
        "Cara|4|new|40.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nORDER BY o.amount DESC, o.id\nLIMIT 3": [
        "Ben|3|shipped|180.00",
        "Ann|6|new|180.00",
        "Cara|7|paid|90.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nORDER BY o.id": [
        "Ann|1|paid|45.00",
        "Ben|3|shipped|180.00",
        "Cara|4|new|40.00",
        "Ann|6|new|180.00",
        "Cara|7|paid|90.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nORDER BY o.id\nLIMIT 3": [
        "Ann|1|paid|45.00",
        "Ben|3|shipped|180.00",
        "Cara|4|new|40.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nORDER BY total DESC, name": [
        "Ann|2|225.00",
        "Ben|1|180.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nORDER BY total DESC, name\nLIMIT 3": [
        "Ann|2|225.00",
        "Ben|1|180.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nORDER BY name": [
        "Ann|2|225.00",
        "Ben|1|180.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nORDER BY name\nLIMIT 3": [
        "Ann|2|225.00",
        "Ben|1|180.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY total DESC, name": [
        "Ann|2|225.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY total DESC, name\nLIMIT 3": [
        "Ann|2|225.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY name": [
        "Ann|2|225.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY name\nLIMIT 3": [
        "Ann|2|225.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nORDER BY o.amount DESC, o.id": [
        "Dev|NULL|NULL|NULL",
        "Ben|3|shipped|180.00",
        "Ann|6|new|180.00",
        "Cara|7|paid|90.00",
        "Ann|1|paid|45.00",
        "Cara|4|new|40.00",
        "Ben|5|paid|20.00",
        "Ann|2|paid|17.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nORDER BY o.amount DESC, o.id\nLIMIT 3": [
        "Dev|NULL|NULL|NULL",
        "Ben|3|shipped|180.00",
        "Ann|6|new|180.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nORDER BY o.id": [
        "Ann|1|paid|45.00",
        "Ann|2|paid|17.00",
        "Ben|3|shipped|180.00",
        "Cara|4|new|40.00",
        "Ben|5|paid|20.00",
        "Ann|6|new|180.00",
        "Cara|7|paid|90.00",
        "Dev|NULL|NULL|NULL"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nORDER BY o.id\nLIMIT 3": [
        "Ann|1|paid|45.00",
        "Ann|2|paid|17.00",
        "Ben|3|shipped|180.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nORDER BY total DESC, name": [
        "Dev|0|NULL",
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nORDER BY total DESC, name\nLIMIT 3": [
        "Dev|0|NULL",
        "Ann|3|242.00",
        "Ben|2|200.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nORDER BY name": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00",
        "Dev|0|NULL"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nORDER BY name\nLIMIT 3": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY total DESC, name": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY total DESC, name\nLIMIT 3": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY name": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY name\nLIMIT 3": [
        "Ann|3|242.00",
        "Ben|2|200.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nORDER BY o.amount DESC, o.id": [
        "Cara|7|paid|90.00",
        "Ann|1|paid|45.00",
        "Ben|5|paid|20.00",
        "Ann|2|paid|17.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nORDER BY o.amount DESC, o.id\nLIMIT 3": [
        "Cara|7|paid|90.00",
        "Ann|1|paid|45.00",
        "Ben|5|paid|20.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nORDER BY o.id": [
        "Ann|1|paid|45.00",
        "Ann|2|paid|17.00",
        "Ben|5|paid|20.00",
        "Cara|7|paid|90.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nORDER BY o.id\nLIMIT 3": [
        "Ann|1|paid|45.00",
        "Ann|2|paid|17.00",
        "Ben|5|paid|20.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nORDER BY total DESC, name": [
        "Cara|1|90.00",
        "Ann|2|62.00",
        "Ben|1|20.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nORDER BY total DESC, name\nLIMIT 3": [
        "Cara|1|90.00",
        "Ann|2|62.00",
        "Ben|1|20.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nORDER BY name": [
        "Ann|2|62.00",
        "Ben|1|20.00",
        "Cara|1|90.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nORDER BY name\nLIMIT 3": [
        "Ann|2|62.00",
        "Ben|1|20.00",
        "Cara|1|90.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY total DESC, name": [
        "Ann|2|62.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY total DESC, name\nLIMIT 3": [
        "Ann|2|62.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY name": [
        "Ann|2|62.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.status = 'paid'\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY name\nLIMIT 3": [
        "Ann|2|62.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nORDER BY o.amount DESC, o.id": [
        "Ben|3|shipped|180.00",
        "Ann|6|new|180.00",
        "Cara|7|paid|90.00",
        "Ann|1|paid|45.00",
        "Cara|4|new|40.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nORDER BY o.amount DESC, o.id\nLIMIT 3": [
        "Ben|3|shipped|180.00",
        "Ann|6|new|180.00",
        "Cara|7|paid|90.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nORDER BY o.id": [
        "Ann|1|paid|45.00",
        "Ben|3|shipped|180.00",
        "Cara|4|new|40.00",
        "Ann|6|new|180.00",
        "Cara|7|paid|90.00"
      ],
      "SELECT c.name, o.id, o.status, o.amount\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nORDER BY o.id\nLIMIT 3": [
        "Ann|1|paid|45.00",
        "Ben|3|shipped|180.00",
        "Cara|4|new|40.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nORDER BY total DESC, name": [
        "Ann|2|225.00",
        "Ben|1|180.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nORDER BY total DESC, name\nLIMIT 3": [
        "Ann|2|225.00",
        "Ben|1|180.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nORDER BY name": [
        "Ann|2|225.00",
        "Ben|1|180.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nORDER BY name\nLIMIT 3": [
        "Ann|2|225.00",
        "Ben|1|180.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY total DESC, name": [
        "Ann|2|225.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY total DESC, name\nLIMIT 3": [
        "Ann|2|225.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY name": [
        "Ann|2|225.00",
        "Cara|2|130.00"
      ],
      "SELECT c.name, count(o.id) AS orders, sum(o.amount) AS total\nFROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.amount >= 40\nGROUP BY c.name\nHAVING count(o.id) >= 2\nORDER BY name\nLIMIT 3": [
        "Ann|2|225.00",
        "Cara|2|130.00"
      ]
    },
    "paging": {
      "points": [
        {
          "offset": 0,
          "offsetMs": 0.02,
          "offsetBuffers": 4,
          "keysetMs": 0.023,
          "keysetBuffers": 4
        },
        {
          "offset": 10000,
          "offsetMs": 1.601,
          "offsetBuffers": 134,
          "keysetMs": 0.022,
          "keysetBuffers": 4
        },
        {
          "offset": 100000,
          "offsetMs": 16.951,
          "offsetBuffers": 1308,
          "keysetMs": 0.026,
          "keysetBuffers": 5
        },
        {
          "offset": 500000,
          "offsetMs": 100.827,
          "offsetBuffers": 6524,
          "keysetMs": 0.03,
          "keysetBuffers": 4
        },
        {
          "offset": 900000,
          "offsetMs": 168.206,
          "offsetBuffers": 11741,
          "keysetMs": 0.018,
          "keysetBuffers": 4
        }
      ],
      "offsetPlan": "Limit (actual time=73.739..73.743 rows=20.00 loops=1)\n  Buffers: shared hit=6524\n  ->  Index Scan using events_pkey on events (actual time=0.007..60.258 rows=500020.00 loops=1)\n        Index Searches: 1\n        Buffers: shared hit=6524\nPlanning Time: 0.019 ms\nExecution Time: 73.755 ms",
      "keysetPlan": "Limit (actual time=0.014..0.017 rows=20.00 loops=1)\n  Buffers: shared hit=4\n  ->  Index Scan using events_pkey on events (actual time=0.013..0.015 rows=20.00 loops=1)\n        Index Cond: (id > 500000)\n        Index Searches: 1\n        Buffers: shared hit=4\nPlanning Time: 0.035 ms\nExecution Time: 0.023 ms"
    },
    "java": [
      "# connect",
      "connected as app to shop",
      "# insert",
      "new customer id = 5",
      "# select",
      "1 Ann",
      "3 Cara",
      "injection attempt found a row: false",
      "# transaction",
      "order 10 inserted (not committed yet)",
      "rolled back: 23503 ERROR: insert or update on table \"orders\" violates foreign key constraint \"orders_product_id_fkey\"",
      "orders for Eve after rollback = 0",
      "# batch",
      "batched 1000 inserts, committed in 27 ms",
      "# upsert",
      "mouse stock = 3",
      "mouse stock = 7",
      "# keyset",
      "page 1: 400 rows, last id 411",
      "page 2: 400 rows, last id 811",
      "page 3: 200 rows, last id 1011"
    ],
    "ts": [
      "# connect",
      "{ current_user: 'app', current_database: 'shop' }",
      "# insert",
      "new customer id = 6 string",
      "# select",
      "[ { id: '1', name: 'Ann' }, { id: '3', name: 'Cara' } ]",
      "[",
      "  { name: 'Keyboard', price: '45.00' },",
      "  { name: 'Webcam', price: '55.00' },",
      "  { name: 'Monitor', price: '180.00' }",
      "] string",
      "# errors",
      "23505 customers_email_key - Key (email)=(fay@example.com) already exists.",
      "# transaction",
      "rolled back: 23503 insert or update on table \"orders\" violates foreign key constraint \"orders_product_id_fkey\"",
      "orders for Fay after rollback = 0",
      "# batch",
      "inserted 1000 rows in one statement, 17 ms",
      "# upsert",
      "{ before: null, after: 5 }",
      "{ before: 5, after: 10 }",
      "# keyset",
      "page 1: 400 rows, last id 1413",
      "page 2: 400 rows, last id 1813",
      "page 3: 200 rows, last id 2013"
    ]
  },
  "schema": {
    "sizes": [
      {
        "type": "boolean",
        "value": "true",
        "bytes": 1
      },
      {
        "type": "smallint",
        "value": "32767",
        "bytes": 2
      },
      {
        "type": "integer",
        "value": "2147483647",
        "bytes": 4
      },
      {
        "type": "bigint",
        "value": "9223372036854775807",
        "bytes": 8
      },
      {
        "type": "real",
        "value": "3.14",
        "bytes": 4
      },
      {
        "type": "double precision",
        "value": "3.14",
        "bytes": 8
      },
      {
        "type": "numeric(12,2)",
        "value": "1234.56",
        "bytes": 7
      },
      {
        "type": "numeric",
        "value": "12345678901234567890.123456",
        "bytes": 17
      },
      {
        "type": "date",
        "value": "2026-10-18",
        "bytes": 4
      },
      {
        "type": "timestamp",
        "value": "2026-10-18 09:30:00",
        "bytes": 8
      },
      {
        "type": "timestamptz",
        "value": "2026-10-18 09:30:00+00",
        "bytes": 8
      },
      {
        "type": "interval",
        "value": "1 day 02:00:00",
        "bytes": 16
      },
      {
        "type": "uuid",
        "value": "0199f2a4-6c1e-7cc2-9d1e-5a3f2b8c4d10",
        "bytes": 16
      },
      {
        "type": "text",
        "value": "Lisbon",
        "bytes": 7
      },
      {
        "type": "varchar(20)",
        "value": "Lisbon",
        "bytes": 7
      },
      {
        "type": "char(20)",
        "value": "Lisbon",
        "bytes": 21
      },
      {
        "type": "text",
        "value": "xxxxxxxxxxxx… (200 chars)",
        "bytes": 204
      },
      {
        "type": "jsonb",
        "value": "{\"size\": \"M\", \"color\": \"red\"}",
        "bytes": 34
      },
      {
        "type": "json",
        "value": "{\"size\": \"M\", \"color\": \"red\"}",
        "bytes": 30
      },
      {
        "type": "integer[]",
        "value": "{1,2,3}",
        "bytes": 33
      },
      {
        "type": "inet",
        "value": "10.0.1.20",
        "bytes": 7
      }
    ],
    "padding": {
      "padded": 72,
      "packed": 51
    },
    "money": "types=# SELECT 0.1::float8 + 0.2::float8 AS float8,\n               0.1::numeric + 0.2::numeric AS numeric,\n               0.1::float8 + 0.2::float8 = 0.3 AS \"float8 = 0.3\";\n       float8        | numeric | float8 = 0.3 \n---------------------+---------+--------------\n 0.30000000000000004 |     0.3 | f\n(1 row)\n\ntypes=# SELECT 0.1::real + 0.2::real AS real, 19.99::real * 3 AS \"3 × 19.99 as real\";\n real | 3 × 19.99 as real \n------+-------------------\n  0.3 | 59.96999931335449\n(1 row)\n\ntypes=# SELECT 1.10::float8 * 3 AS float8, 1.10::numeric * 3 AS numeric;\n       float8       | numeric \n--------------------+---------\n 3.3000000000000003 |    3.30\n(1 row)",
    "sums": [
      {
        "n": 10,
        "float8": "0.9999999999999999",
        "numeric": "1.0"
      },
      {
        "n": 100,
        "float8": "9.99999999999998",
        "numeric": "10.0"
      },
      {
        "n": 1000,
        "float8": "99.9999999999986",
        "numeric": "100.0"
      },
      {
        "n": 10000,
        "float8": "1000.0000000001588",
        "numeric": "1000.0"
      },
      {
        "n": 100000,
        "float8": "10000.000000018848",
        "numeric": "10000.0"
      },
      {
        "n": 1000000,
        "float8": "100000.00000133288",
        "numeric": "100000.0"
      }
    ],
    "times": [
      {
        "readIn": "UTC",
        "written_in": "UTC",
        "ts": "2026-03-29 09:00:00",
        "tstz": "2026-03-29 09:00:00+00"
      },
      {
        "readIn": "UTC",
        "written_in": "Asia/Tokyo",
        "ts": "2026-03-29 09:00:00",
        "tstz": "2026-03-29 00:00:00+00"
      },
      {
        "readIn": "Europe/Lisbon",
        "written_in": "UTC",
        "ts": "2026-03-29 09:00:00",
        "tstz": "2026-03-29 10:00:00+01"
      },
      {
        "readIn": "Europe/Lisbon",
        "written_in": "Asia/Tokyo",
        "ts": "2026-03-29 09:00:00",
        "tstz": "2026-03-29 00:00:00+00"
      },
      {
        "readIn": "America/New_York",
        "written_in": "UTC",
        "ts": "2026-03-29 09:00:00",
        "tstz": "2026-03-29 05:00:00-04"
      },
      {
        "readIn": "America/New_York",
        "written_in": "Asia/Tokyo",
        "ts": "2026-03-29 09:00:00",
        "tstz": "2026-03-28 20:00:00-04"
      },
      {
        "readIn": "Asia/Tokyo",
        "written_in": "UTC",
        "ts": "2026-03-29 09:00:00",
        "tstz": "2026-03-29 18:00:00+09"
      },
      {
        "readIn": "Asia/Tokyo",
        "written_in": "Asia/Tokyo",
        "ts": "2026-03-29 09:00:00",
        "tstz": "2026-03-29 09:00:00+09"
      }
    ],
    "timesPsql": "types=# SET TIME ZONE 'Europe/Lisbon';\nSET\n\ntypes=# SELECT timestamptz '2026-03-29 00:30' + interval '1 day' AS \"plus 1 day\",\n               timestamptz '2026-03-29 00:30' + interval '24 hours' AS \"plus 24 hours\";\n       plus 1 day       |     plus 24 hours      \n------------------------+------------------------\n 2026-03-30 00:30:00+01 | 2026-03-30 01:30:00+01\n(1 row)",
    "text": {
      "text": "types=# CREATE TABLE names (code varchar(5), label char(5));\nCREATE TABLE\n\ntypes=# INSERT INTO names VALUES ('ABCDEFG', 'x');\nERROR:  value too long for type character varying(5)\n\ntypes=# SELECT 'ABCDEFG'::varchar(5) AS cast_cuts_silently;\n cast_cuts_silently \n--------------------\n ABCDE\n(1 row)\n\ntypes=# SELECT 'ab'::char(5) = 'ab   ' AS equal, length('ab'::char(5)), 'ab'::char(5) || '|' AS concat;\n equal | length | concat \n-------+--------+--------\n t     |      2 | ab|\n(1 row)",
      "ints": "types=# SELECT 2147483647::int + 1;\nERROR:  integer out of range\n\ntypes=# SELECT 2147483647::bigint + 1 AS bigint_ok;\n bigint_ok  \n------------\n 2147483648\n(1 row)\n\ntypes=# CREATE TABLE tickets (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text);\nCREATE TABLE\n\ntypes=# INSERT INTO tickets (id, title) VALUES (42, 'manual id');\nERROR:  cannot insert a non-DEFAULT value into column \"id\"\nDETAIL:  Column \"id\" is an identity column defined as GENERATED ALWAYS.\nHINT:  Use OVERRIDING SYSTEM VALUE to override.\n\ntypes=# INSERT INTO tickets (title) VALUES ('first'), ('second') RETURNING id;\n id \n----\n  1\n  2\n(2 rows)\n\nINSERT 0 2",
      "uuid": "types=# SELECT gen_random_uuid() AS v4 FROM generate_series(1, 3);\n                  v4                  \n--------------------------------------\n 89bcd29c-3ba7-4a21-8b10-fae67c588e28\n 6c3ea4d8-1ad1-451b-b738-910f77d77b79\n 6d49049c-ed60-4e14-9bbc-7823f6157af5\n(3 rows)\n\ntypes=# SELECT uuidv7() AS v7 FROM generate_series(1, 3);\n                  v7                  \n--------------------------------------\n 01a14e10-1b9b-7965-ab79-379ed5bd563b\n 01a14e10-1b9b-7984-96e8-51fccd68544c\n 01a14e10-1b9b-798c-aaf1-267a6b71bc92\n(3 rows)\n\ntypes=# SELECT uuid_extract_timestamp(uuidv7()) IS NOT NULL AS has_time, uuid_extract_version(uuidv7()) AS version;\n has_time | version \n----------+---------\n t        |       7\n(1 row)",
      "json": "types=# SELECT '{\"b\": 1, \"a\": 2, \"a\": 3}'::json  AS json,\n               '{\"b\": 1, \"a\": 2, \"a\": 3}'::jsonb AS jsonb;\n           json           |      jsonb       \n--------------------------+------------------\n {\"b\": 1, \"a\": 2, \"a\": 3} | {\"a\": 3, \"b\": 1}\n(1 row)\n\ntypes=# SELECT attrs ->> 'color' AS color, attrs @> '{\"size\": \"M\"}' AS is_m\n        FROM (VALUES ('{\"size\": \"M\", \"color\": \"red\"}'::jsonb)) v(attrs);\n color | is_m \n-------+------\n red   | t\n(1 row)",
      "arrays": "types=# CREATE TABLE posts (id int PRIMARY KEY, tags text[] NOT NULL DEFAULT '{}');\nCREATE TABLE\n\ntypes=# INSERT INTO posts VALUES (1, '{sale,new}'), (2, '{new}'), (3, '{}');\nINSERT 0 3\n\ntypes=# SELECT id, tags FROM posts WHERE 'sale' = ANY (tags);\n id |    tags    \n----+------------\n  1 | {sale,new}\n(1 row)\n\ntypes=# SELECT id, tags FROM posts WHERE tags @> '{new}' ORDER BY id;\n id |    tags    \n----+------------\n  1 | {sale,new}\n  2 | {new}\n(2 rows)",
      "enums": "types=# CREATE TYPE order_status AS ENUM ('new', 'paid', 'shipped');\nCREATE TYPE\n\ntypes=# CREATE TABLE shipments (id int PRIMARY KEY, status order_status NOT NULL);\nCREATE TABLE\n\ntypes=# INSERT INTO shipments VALUES (1, 'shipped'), (2, 'new'), (3, 'paid');\nINSERT 0 3\n\ntypes=# INSERT INTO shipments VALUES (4, 'refunded');\nERROR:  invalid input value for enum order_status: \"refunded\"\nLINE 1: INSERT INTO shipments VALUES (4, 'refunded');\n                                         ^\n\ntypes=# ALTER TYPE order_status ADD VALUE 'refunded' AFTER 'paid';\nALTER TYPE\n\ntypes=# SELECT id, status FROM shipments ORDER BY status;\n id | status  \n----+---------\n  2 | new\n  3 | paid\n  1 | shipped\n(3 rows)\n\ntypes=# ALTER TYPE order_status DROP VALUE 'new';\nERROR:  dropping an enum value is not implemented\nLINE 1: ALTER TYPE order_status DROP VALUE 'new';\n                                ^"
    },
    "keys": [
      {
        "label": "bigint identity",
        "ms": 2005,
        "indexMB": 21.4,
        "heapMB": 42.2,
        "walMB": 135.3
      },
      {
        "label": "uuid v7",
        "ms": 2476,
        "indexMB": 30.1,
        "heapMB": 49.8,
        "walMB": 148.5
      },
      {
        "label": "uuid v4",
        "ms": 3810,
        "indexMB": 37.9,
        "heapMB": 49.8,
        "walMB": 162.3
      }
    ],
    "constraints": "types=# CREATE TABLE accounts (\n          id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n          email   text NOT NULL UNIQUE,\n          balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0)\n        );\nCREATE TABLE\n\ntypes=# INSERT INTO accounts (email) VALUES ('ann@example.com');\nINSERT 0 1\n\ntypes=# INSERT INTO accounts (email) VALUES ('ann@example.com');\nERROR:  duplicate key value violates unique constraint \"accounts_email_key\"\nDETAIL:  Key (email)=(ann@example.com) already exists.\n\ntypes=# INSERT INTO accounts (email) VALUES (NULL);\nERROR:  null value in column \"email\" of relation \"accounts\" violates not-null constraint\nDETAIL:  Failing row contains (3, null, 0.00).\n\ntypes=# UPDATE accounts SET balance = balance - 10 WHERE email = 'ann@example.com';\nERROR:  new row for relation \"accounts\" violates check constraint \"accounts_balance_check\"\nDETAIL:  Failing row contains (1, ann@example.com, -10.00).",
    "onDelete": {
      "NO ACTION": "types=# DELETE FROM customers WHERE id = 1;\nERROR:  update or delete on table \"customers\" violates foreign key constraint \"orders_customer_id_fkey\" on table \"orders\"\nDETAIL:  Key (id)=(1) is still referenced from table \"orders\".\n\ntypes=# SELECT id, customer_id FROM orders ORDER BY id;\n id | customer_id \n----+-------------\n 10 |           1\n 11 |           1\n 12 |           2\n(3 rows)",
      "RESTRICT": "types=# DELETE FROM customers WHERE id = 1;\nERROR:  update or delete on table \"customers\" violates RESTRICT setting of foreign key constraint \"orders_customer_id_fkey\" on table \"orders\"\nDETAIL:  Key (id)=(1) is referenced from table \"orders\".\n\ntypes=# SELECT id, customer_id FROM orders ORDER BY id;\n id | customer_id \n----+-------------\n 10 |           1\n 11 |           1\n 12 |           2\n(3 rows)",
      "CASCADE": "types=# DELETE FROM customers WHERE id = 1;\nDELETE 1\n\ntypes=# SELECT id, customer_id FROM orders ORDER BY id;\n id | customer_id \n----+-------------\n 12 |           2\n(1 row)",
      "SET NULL": "types=# DELETE FROM customers WHERE id = 1;\nDELETE 1\n\ntypes=# SELECT id, customer_id FROM orders ORDER BY id;\n id | customer_id \n----+-------------\n 10 |            \n 11 |            \n 12 |           2\n(3 rows)"
    },
    "migrations": [
      {
        "label": "ADD COLUMN, no default",
        "sql": "ALTER TABLE items ADD COLUMN note text",
        "ms": 1.7,
        "rewrite": false
      },
      {
        "label": "ADD COLUMN … DEFAULT false NOT NULL",
        "sql": "ALTER TABLE items ADD COLUMN active boolean NOT NULL DEFAULT false",
        "ms": 1.9,
        "rewrite": false
      },
      {
        "label": "ADD COLUMN … DEFAULT clock_timestamp()",
        "sql": "ALTER TABLE items ADD COLUMN created_at timestamptz NOT NULL DEFAULT clock_timestamp()",
        "ms": 969.5,
        "rewrite": true
      },
      {
        "label": "ALTER COLUMN qty TYPE bigint",
        "sql": "ALTER TABLE items ALTER COLUMN qty TYPE bigint",
        "ms": 807.4,
        "rewrite": true
      },
      {
        "label": "SET NOT NULL (scans)",
        "sql": "ALTER TABLE items ALTER COLUMN sku SET NOT NULL",
        "ms": 159.7,
        "rewrite": false
      },
      {
        "label": "ADD CHECK … NOT VALID",
        "sql": "ALTER TABLE items ADD CONSTRAINT items_qty_check CHECK (qty >= 0) NOT VALID",
        "ms": 2.4,
        "rewrite": false
      },
      {
        "label": "VALIDATE CONSTRAINT",
        "sql": "ALTER TABLE items VALIDATE CONSTRAINT items_qty_check",
        "ms": 40.8,
        "rewrite": false
      },
      {
        "label": "CREATE INDEX",
        "sql": "CREATE INDEX items_sku_idx ON items (sku)",
        "ms": 1386.9,
        "rewrite": false
      },
      {
        "label": "CREATE INDEX CONCURRENTLY",
        "sql": "CREATE INDEX CONCURRENTLY items_sku_idx2 ON items (sku)",
        "ms": 1478.6,
        "rewrite": false
      }
    ],
    "lockQueue": {
      "events": [
        {
          "lane": "A",
          "at": 20,
          "label": "BEGIN; SELECT … (keeps its lock)"
        },
        {
          "lane": "B",
          "at": 330,
          "label": "ALTER TABLE items ADD COLUMN …"
        },
        {
          "lane": "C",
          "at": 630,
          "label": "SELECT … WHERE id = 1"
        },
        {
          "lane": "A",
          "at": 2430,
          "label": "COMMIT"
        },
        {
          "lane": "B",
          "at": 2440,
          "label": "ALTER done",
          "ok": true
        },
        {
          "lane": "C",
          "at": 2440,
          "label": "SELECT done",
          "ok": true
        }
      ],
      "waiting": [
        {
          "session": "B",
          "wait": "Lock:relation",
          "blockedBy": [
            "A"
          ]
        },
        {
          "session": "C",
          "wait": "Lock:relation",
          "blockedBy": [
            "B"
          ]
        }
      ],
      "bStart": 330,
      "cStart": 630,
      "commitAt": 2430,
      "end": 2440
    },
    "lockTimeout": {
      "events": [
        {
          "lane": "A",
          "at": 30,
          "label": "BEGIN; SELECT … (keeps its lock)"
        },
        {
          "lane": "B",
          "at": 340,
          "label": "ALTER TABLE items ADD COLUMN …"
        },
        {
          "lane": "B",
          "at": 540,
          "label": "ERROR: canceling statement due to lock timeout",
          "ok": false
        },
        {
          "lane": "C",
          "at": 640,
          "label": "SELECT … WHERE id = 1"
        },
        {
          "lane": "C",
          "at": 640,
          "label": "SELECT done",
          "ok": true
        },
        {
          "lane": "A",
          "at": 2440,
          "label": "COMMIT"
        }
      ],
      "waiting": [
        {
          "session": "B",
          "wait": "Client:ClientRead",
          "blockedBy": []
        },
        {
          "session": "C",
          "wait": "Client:ClientRead",
          "blockedBy": []
        }
      ],
      "bStart": 340,
      "cStart": 640,
      "commitAt": 2440,
      "end": 2440
    }
  }
}
