import swaggerAutogen from "swagger-autogen";

const doc = {
    info: {
        title: "Auth service API",
        description: "Automatically generated swagger docs",
        version: "1.0.0",
    },
    host: "localhost:6001",
    schemes: ["https"]
};

const outputfile = "./swagger-output.json";
const endpointFiles = ["./routes/auth.router.ts"]

swaggerAutogen()(outputfile, endpointFiles, doc);