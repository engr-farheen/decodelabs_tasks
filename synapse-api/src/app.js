const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./swagger');
const { generalLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const linkRoutes = require('./routes/linkRoutes');
const { redirect } = require('./controllers/linkController');

const app = express();
app.set('trust proxy', 1);

// ---- Global middleware ----
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled only for the landing page's inline styles
app.use(cors());
app.use(express.json({ limit: '10kb' })); // small, deliberate cap — this API has no reason to accept large payloads
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(generalLimiter);

// ---- Static landing page ----
app.use(express.static(path.join(__dirname, 'public')));

// ---- API documentation ----
const swaggerDarkTheme = `
  body { background: #0A0B0F; }
  .swagger-ui { font-family: 'Inter', sans-serif; }
  .swagger-ui .topbar { background: #0A0B0F; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .swagger-ui .info .title, .swagger-ui .info h1, .swagger-ui .info h2, .swagger-ui .info h3 { color: #EDEDF2; }
  .swagger-ui .info .title small.version-stamp { background: linear-gradient(120deg, #7C6FFF, #22D3EE); }
  .swagger-ui .info a { color: #22D3EE; }
  .swagger-ui .scheme-container { background: #14151C; box-shadow: none; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .swagger-ui .opblock-tag { color: #EDEDF2; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .swagger-ui .opblock { background: #14151C; border-color: rgba(255,255,255,0.1); box-shadow: none; }
  .swagger-ui .opblock .opblock-summary-description { color: #9A9AAC; }
  .swagger-ui .opblock.opblock-post { border-color: #34D399; background: rgba(52,211,153,0.06); }
  .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #34D399; }
  .swagger-ui .opblock.opblock-get { border-color: #22D3EE; background: rgba(34,211,238,0.06); }
  .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #22D3EE; color: #0A0B0F; }
  .swagger-ui .opblock.opblock-patch { border-color: #7C6FFF; background: rgba(124,111,255,0.06); }
  .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #7C6FFF; }
  .swagger-ui .opblock.opblock-delete { border-color: #FB7185; background: rgba(251,113,133,0.06); }
  .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #FB7185; }
  .swagger-ui .opblock-summary-path, .swagger-ui .opblock-summary-path__deprecated { color: #EDEDF2; }
  .swagger-ui .btn.authorize { background: #14151C; color: #22D3EE; border-color: #22D3EE; }
  .swagger-ui .btn.execute { background: linear-gradient(120deg, #7C6FFF, #22D3EE); border: none; color: #0A0B0F; font-weight: 700; }
  .swagger-ui select, .swagger-ui input[type=text], .swagger-ui textarea { background: #1B1D27; color: #EDEDF2; border-color: rgba(255,255,255,0.15); }
  .swagger-ui .model-box, .swagger-ui .responses-inner, .swagger-ui table thead tr td, .swagger-ui table thead tr th { background: #14151C; color: #EDEDF2; }
  .swagger-ui .response-col_status { color: #9A9AAC; }
  .swagger-ui .parameter__name, .swagger-ui .parameter__type, .swagger-ui label { color: #EDEDF2; }
  .swagger-ui .markdown p, .swagger-ui .opblock-description-wrapper p { color: #9A9AAC; }
`;

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: swaggerDarkTheme,
  customSiteTitle: 'Synapse API Docs',
}));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ---- Health check — useful for uptime monitors / load balancers ----
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// ---- API routes ----
app.use('/api/auth', authRoutes);
app.use('/api/links', linkRoutes);

// ---- The actual short-link redirect. Deliberately mounted at the root
// (e.g. GET /aB3xQ9z) rather than under /api, since a short link is
// only actually "short" if it skips that prefix. ----
app.get('/:code', redirect);

// ---- 404 + centralized error handling (must be registered last) ----
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
