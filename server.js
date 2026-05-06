const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// 信任代理，以便正确获取 IP（Railway 必须）
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data.json');

// 文件读写
function readData() {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch { return []; }
}
function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data));
}

// IP 限流配置
const RATE_LIMIT_WINDOW = 60 * 1000;  // 1 分钟
const MAX_PER_WINDOW = 1;             // 每分钟最多 1 次

// 内存中的 IP 记录：{ ip: [时间戳, ...] }
const ipRecords = {};

// 清理过期记录
function cleanOldRecords(ip) {
    const now = Date.now();
    if (ipRecords[ip]) {
        ipRecords[ip] = ipRecords[ip].filter(t => now - t < RATE_LIMIT_WINDOW);
        if (ipRecords[ip].length === 0) delete ipRecords[ip];
    }
}

// 检查并记录 IP
function checkAndRecordIP(ip) {
    cleanOldRecords(ip);
    if (!ipRecords[ip]) ipRecords[ip] = [];
    if (ipRecords[ip].length >= MAX_PER_WINDOW) {
        return false; // 超限
    }
    ipRecords[ip].push(Date.now());
    return true;
}

// 上香接口
app.post('/api/memorial', (req, res) => {
    const ip = req.ip;
    if (!checkAndRecordIP(ip)) {
        return res.status(429).json({ error: '您上香太频繁了，请1分钟后再来。' });
    }

    const { name, isAnonymous } = req.body;
    const record = {
        id: Date.now(),
        name: isAnonymous ? '匿名' : (name || '匿名'),
        is_anonymous: isAnonymous,
        created_at: new Date().toISOString()
    };
    const data = readData();
    data.push(record);
    writeData(data);
    res.json({ success: true });
});

// 获取纪念记录
app.get('/api/memorials', (req, res) => {
    const data = readData();
    res.json(data.slice(-200).reverse());
});

// 获取总次数
app.get('/api/total', (req, res) => {
    res.json({ total: readData().length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`竹秋纪念碑运行在端口 ${PORT}`));
