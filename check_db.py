import sqlite3
import os
db_path = 'backend/databases/master.db'
print(f'Using: {db_path}')
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cur.fetchall()
print('Tables:', [t[0] for t in tables])
cur.execute("PRAGMA table_info(contacts)")
cols = cur.fetchall()
if cols:
    print('Contacts columns:', [(c[1], c[2]) for c in cols])
else:
    print('No contacts table found')
cur.execute("SELECT COUNT(*) FROM buyers")
print('Buyers count:', cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM sellers")
print('Sellers count:', cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM property_sales")
print('Property sales count:', cur.fetchone()[0])
conn.close()
