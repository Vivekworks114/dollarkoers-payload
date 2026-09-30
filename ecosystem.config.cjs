/**
 * PM2 ecosystem file — production process manager config.
 *
 * Usage on the VPS (one-time setup):
 *   pnpm install
 *   pnpm --filter @dollarkoers/payload run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup    # follow the printed instructions so PM2 starts on boot
 *
 * To deploy a code update:
 *   git pull
 *   pnpm install
 *   pnpm --filter @dollarkoers/payload run build
 *   pm2 reload dollarkoers-payload
 *
 * To inspect:
 *   pm2 status
 *   pm2 logs dollarkoers-payload --lines 200
 */
module.exports = {
  apps: [
    {
      name: 'dollarkoers-payload',
      cwd: './apps/payload',
      script: 'pnpm',
      args: 'run start:prod',
      // Keep node version + memory bounded. Bump --max-old-space-size if your
      // admin starts OOMing while bulk-saving media or running migrations.
      node_args: '--max-old-space-size=2048',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      // Critical: NODE_ENV controls Payload's cookie `secure` default and
      // disables auto-`push` on the DB. Always 'production' on the server.
      env: {
        NODE_ENV: 'production',
      },
      // Log to disk so PM2 doesn't drop them.
      out_file: '/var/log/dollarkoers-payload/out.log',
      error_file: '/var/log/dollarkoers-payload/err.log',
      merge_logs: true,
      time: true,
    },
  ],
}
