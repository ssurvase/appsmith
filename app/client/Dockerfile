# --------------------------------------------------------------------
#  BUILDING UI
# --------------------------------------------------------------------

FROM node:14 as build

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./

RUN yarn global add @craco/craco craco-alias tailwindcss autoprefixer
RUN yarn install

COPY . ./

RUN ["craco" , "build"]

# --------------------------------------------------------------------
#  PACKAGING UI
# --------------------------------------------------------------------

FROM nginx:stable-alpine

COPY --from=build /app/build/ /usr/share/nginx/html
COPY /nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
