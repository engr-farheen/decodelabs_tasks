const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Synapse API',
      version: '1.0.0',
      description:
        'A production-style URL shortener API. Every endpoint below is live — ' +
        'use "Try it out" to send real requests against this running server.',
    },
    servers: [{ url: process.env.BASE_URL || 'http://localhost:3000' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
