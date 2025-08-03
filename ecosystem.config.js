module.exports = {
  apps: [
    {
      name: 'rogan-writer',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/rogan-writer/current',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/www/rogan-writer/logs/err.log',
      out_file: '/var/www/rogan-writer/logs/out.log',
      log_file: '/var/www/rogan-writer/logs/combined.log',
      time: true,
      // Ensure we're using Node.js 18
      interpreter: 'node',
      node_args: '--max-old-space-size=1024',
      // Restart policy
      restart_delay: 4000,
      min_uptime: '10s',
      max_restarts: 10
    }
  ]
}; 