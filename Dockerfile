# Stage 0: "install-stage", based on Node.js, to install dependencies
FROM node:lts-slim as install-stage

WORKDIR /app
# Copy the package.json
COPY package.json /app/
# Install node_modules
RUN npm install

# Stage 1: "build-stage" based on Node.js image, to build the compiled app (build folder)
FROM node:lts-slim as build-stage
WORKDIR /app
COPY --from=install-stage /app /app
COPY src /app/src
COPY tsconfig.json /app/tsconfig.json
# Run build
RUN npm run build:main

# Stage 2, based on NodeJs, to have only the compiled app, ready for production with Nginx
FROM node:lts-slim

# Labels for GitHub to read your action
LABEL "maintainer"="Decathlon <developers@decathlon.com>"
LABEL "com.github.actions.name"="PR label by Files"
LABEL "com.github.actions.description"="Label a Pull Request based on pushed files "
# Here are all of the available icons: https://feathericons.com/
LABEL "com.github.actions.icon"="file-text"
# And all of the available colors: https://developer.github.com/actions/creating-github-actions/creating-a-docker-container/#label
LABEL "com.github.actions.color"="green"

COPY --from=build-stage /app /app
# Run `node /app/build/entrypoint.js`
ENTRYPOINT ["node", "/app/build/entrypoint.js"]

