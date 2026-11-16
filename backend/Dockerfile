# GitHub Actions builds this image. The VPS only pulls the published image and starts it.

FROM php:8.4-cli-bookworm AS vendor
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
RUN apt-get update \
    && apt-get install -y --no-install-recommends unzip git \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-autoloader
COPY . .
RUN composer dump-autoload --optimize --no-dev --no-scripts

FROM node:22-bookworm-slim AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM php:8.4-fpm-bookworm AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx libpq-dev \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql pcntl bcmath opcache \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default
COPY docker/nginx-log-format.conf /etc/nginx/conf.d/00-laravel-log.conf
COPY docker/nginx.conf /etc/nginx/sites-available/laravel.conf
COPY docker/php-fpm.conf /usr/local/etc/php-fpm.d/zz-laravel.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && ln -sf /etc/nginx/sites-available/laravel.conf /etc/nginx/sites-enabled/laravel.conf
WORKDIR /var/www/html
COPY --from=vendor /app /var/www/html
COPY --from=assets /app/public/build /var/www/html/public/build
RUN rm -f bootstrap/cache/*.php \
    && APP_KEY="$(php -r 'echo "base64:".base64_encode(random_bytes(32));')" \
    php artisan package:discover --ansi \
    && chown -R www-data:www-data storage bootstrap/cache
EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
CMD ["serve"]
