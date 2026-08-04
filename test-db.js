const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Products matching filter 2:', await prisma.products.count({
        where: {
            OR: [
                { starting_date: null },
                { starting_date: { isSet: false } },
                { ending_date: null },
                { ending_date: { isSet: false } }
            ]
        }
    }));
}

main().finally(() => prisma.$disconnect());
