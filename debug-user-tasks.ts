
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const groupId = 6

    const states = ['imported', 'transcribing', 'trashed', 'submitted', 'accepted', 'finalised']

    console.log(`Task Counts for Group ${groupId}:`)
    for (const state of states) {
        const count = await prisma.task.count({
            where: {
                group_id: groupId,
                state: state as any
            }
        })
        console.log(`${state}: ${count}`)
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
