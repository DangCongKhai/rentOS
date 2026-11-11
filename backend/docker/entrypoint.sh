#!/bin/sh
set -eu

cd /var/www/html

mkdir -p \
    storage/app/public \
    storage/app/private \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache

php artisan config:cache

if [ "${1:-serve}" = "serve" ]; then
    php-fpm --daemonize
    exec nginx -g 'daemon off;'
fi

exec setpriv --reuid=www-data --regid=www-data --init-groups --inh-caps=-all "$@"
