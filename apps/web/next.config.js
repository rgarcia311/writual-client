/** @type {import('next').NextConfig} */
const path = require('path')
const nextConfig = {
    sassOptions: {
        includePaths: [path.join(__dirname, '/src/app/styles')],
    },
    experimental: {
        webpackMemoryOptimizations: true,
    },
  }
   
  module.exports = nextConfig