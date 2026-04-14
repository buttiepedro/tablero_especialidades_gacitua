FROM nginx:alpine

COPY index.html /usr/share/nginx/html/index.html
COPY general.html /usr/share/nginx/html/general.html
COPY especialidades.html /usr/share/nginx/html/especialidades.html
COPY login.js /usr/share/nginx/html/login.js
COPY general.js /usr/share/nginx/html/general.js
COPY especialidades.js /usr/share/nginx/html/especialidades.js
COPY shared.js /usr/share/nginx/html/shared.js
COPY styles.css /usr/share/nginx/html/styles.css
COPY config.js /usr/share/nginx/html/config.js
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
