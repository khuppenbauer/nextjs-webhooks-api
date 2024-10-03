FROM node:18

# Install gpsbabel
RUN apt-get update && \
    apt-get install -y gpsbabel && \
    apt-get clean

# Set the working directory
WORKDIR /app

# Copy the package.json and package-lock.json files to the working directory
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Build the Next.js app
RUN npm run build

# Start the Next.js app
CMD ["npm", "start"]

# Expose port 3000
EXPOSE 3000
