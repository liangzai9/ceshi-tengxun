const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// 配置CORS，允许所有来源访问（生产环境应限制特定域名）
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// 解析JSON请求体
app.use(express.json());

// 设置请求超时和重试配置
const axiosInstance = axios.create({
    timeout: 15000, // 15秒超时
    maxRedirects: 5, // 允许重定向
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    }
});

// 主代理接口
app.get('/get-data', async (req, res) => {
    const targetUrl = 'http://qniupin.com/api/tencent/onlineim';
    
    try {
        console.log(`[${new Date().toISOString()}] 正在请求目标网站: ${targetUrl}`);
        
        const response = await axiosInstance.get(targetUrl);
        
        // 记录成功日志
        console.log(`[${new Date().toISOString()}] 请求成功，状态码: ${response.status}`);
        console.log(`[${new Date().toISOString()}] 数据条数: ${Array.isArray(response.data) ? response.data.length : '非数组'}`);
        
        // 添加缓存控制头
        res.setHeader('Cache-Control', 'public, max-age=60'); // 缓存60秒
        res.setHeader('Last-Modified', new Date().toUTCString());
        
        // 返回数据
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            data: response.data,
            source: 'qniupin.com'
        });
        
    } catch (error) {
        console.error(`[${new Date().toISOString()}] 请求失败:`, error.message);
        
        // 更详细的错误分类处理
        if (error.code === 'ECONNRESET') {
            res.status(503).json({
                success: false,
                error: 'CONNECTION_RESET',
                message: '目标服务器中断了连接',
                timestamp: new Date().toISOString(),
                suggestions: [
                    '服务器可能暂时不可用，请稍后重试',
                    '检查网络连接是否正常',
                    '确认目标网站是否可访问'
                ]
            });
        } else if (error.code === 'ETIMEDOUT') {
            res.status(504).json({
                success: false,
                error: 'TIMEOUT',
                message: '请求超时',
                timestamp: new Date().toISOString(),
                timeout: error.config?.timeout || 15000
            });
        } else if (error.response) {
            // 服务器响应了错误状态码
            res.status(error.response.status).json({
                success: false,
                error: 'HTTP_ERROR',
                message: `目标服务器返回错误: ${error.response.status}`,
                status: error.response.status,
                timestamp: new Date().toISOString()
            });
        } else if (error.request) {
            // 请求已发送但无响应
            res.status(502).json({
                success: false,
                error: 'NO_RESPONSE',
                message: '无法连接到目标服务器',
                timestamp: new Date().toISOString()
            });
        } else {
            // 其他错误
            res.status(500).json({
                success: false,
                error: 'UNKNOWN_ERROR',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
});

// 健康检查接口
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'tencent-im-proxy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 数据统计接口（基于当前附件信息）
app.get('/stats', (req, res) => {
    // 这里可以添加从目标接口获取的数据统计逻辑
    res.json({
        service: '腾讯在线IM数据代理',
        target: 'http://qniupin.com/api/tencent/onlineim',
        features: [
            '跨域请求代理',
            '错误重试机制',
            '详细日志记录',
            '健康检查'
        ],
        timestamp: new Date().toISOString()
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `路由 ${req.path} 不存在`,
        availableRoutes: ['/get-data', '/health', '/stats']
    });
});

// 全局错误处理
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] 全局错误:`, err);
    res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: '服务器内部错误',
        timestamp: new Date().toISOString()
    });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ 代理服务器已启动！`);
    console.log(`📡 本地访问: http://localhost:${PORT}`);
    console.log(`🔗 主接口: http://localhost:${PORT}/get-data`);
    console.log(`❤️  健康检查: http://localhost:${PORT}/health`);
    console.log(`📊 服务信息: http://localhost:${PORT}/stats`);
});
