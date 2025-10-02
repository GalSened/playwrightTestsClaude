import gateway from './services/gateway/index';

// Start the QA Intelligence Elysia Gateway
gateway.listen(3100, (server) => {
  console.log(`🚀 QA Intelligence Elysia Gateway is running at http://localhost:3100`);
  console.log(`📊 Performance: Running on Bun ${Bun.version}`);
  console.log(`📖 API Docs: http://localhost:3100/docs`);
  console.log(`💚 Health: http://localhost:3100/health`);
});