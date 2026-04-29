const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.env.APPDATA, 'KeyFlow', 'keyflow.db');
try {
    const db = new Database(dbPath);
    const rows = db.prepare("SELECT * FROM patterns WHERE name LIKE '%Hu Tao%' OR name LIKE '%hutao%' OR character LIKE '%Hu Tao%' OR character LIKE '%hutao%'").all();
    console.log(JSON.stringify(rows, null, 2));
} catch (e) {
    console.error(e);
}
