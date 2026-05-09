import swaggerAutogen from "swagger-autogen";

const doc = {
    info: {
        title: "Product service API",
        description: "Automatically generated swagger docs",
        version: "1.0.0",
    },
    host: "localhost:6002",
    schemes: ["http"]
};

const outputfile = "./swagger-output.json";
const endpointFiles = ["../routes/product.router.ts"]

swaggerAutogen()(outputfile, endpointFiles, doc);