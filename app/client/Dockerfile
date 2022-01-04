# --------------------------------------------------------------------
#  BUILDING UI
# --------------------------------------------------------------------
FROM node:14 as BUILDER

COPY package.json .

RUN npm i 

RUN npm i -g @craco/craco tailwindcss autoprefixer

COPY craco.build.config.js .
COPY craco.common.config.js .
COPY craco.dev.config.js .
COPY cypress .
COPY cypress.env.json .
COPY cypress.json .
COPY docker .
COPY generators .
COPY gitbook-algolia-lambda.js .
COPY index.tsx .
COPY jest.config.js .
COPY netlify.toml .
COPY patches .
COPY public .
COPY README.md .
COPY README.old.md .
COPY src .
COPY start-https.sh .
COPY stats.json .
COPY tailwind.config.js .
COPY test .
COPY tsconfig.json .
COPY tsconfig.path.json .
COPY typings .
COPY vercel.json .
COPY yarn.lock .

COPY build.sh .

RUN . ./build.sh


# --------------------------------------------------------------------
#  PACKAGING UI
# --------------------------------------------------------------------
FROM nginx:1.20-alpine

COPY --from=BUILDER /build /var/www/appsmith

EXPOSE 80

ENV APPSMITH_SERVER_PROXY_PASS="http://appsmith-internal-server:8080"

# This is the default nginx template file inside the container.
# This is replaced by the install.sh script during a deployment
# COPY ./docker/templates/nginx-app.conf.template /nginx.conf.template
COPY ./docker/templates/nginx-root.conf.template /nginx-root.conf.template

COPY ./docker/templates/nginx-app-http.conf.template /etc/nginx/templates/
COPY ./docker/templates/nginx-app-https.conf.template /nginx-app-https.conf.template

# This is the script that is used to start Nginx when the Docker container starts
COPY ./docker/start-nginx.sh /start-nginx.sh
CMD ["/start-nginx.sh"]
