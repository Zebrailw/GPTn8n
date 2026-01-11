FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY ../../packages/shared /packages/shared
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]
