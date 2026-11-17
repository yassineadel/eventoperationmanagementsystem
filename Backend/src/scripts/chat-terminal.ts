/// <reference types="node" />
// Chat with the assistant in the terminal, without the website or the server running.
// Run with: npm run ai:chat
// Remembers the conversation like the website does, so follow-up questions work.
// Commands: /sources toggles showing which knowledge-base texts were found; /new starts over; /exit quits.
//   /as someone@demo.hafletna.test   chat as that account (to test "my tickets" questions; local testing only)
//   /as                              back to chatting as a visitor
import readline from 'readline/promises'
import prisma from '../config/db'
import { isLlmConfigured } from '../modules/intelligence/llm'
import { searchKnowledge } from '../modules/intelligence/knowledge/search'
import { ChatError, reply, type ChatRequest } from '../modules/intelligence/chat/chat.service'

async function main() {
  if (!isLlmConfigured()) {
    console.error('GEMINI_API_KEY is not set in Backend/.env')
    process.exit(1)
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  let messages: ChatRequest['messages'] = []
  let showSources = false
  let asUser: { id: string; email: string; role: string } | undefined
  console.log('Ask the Hafletna assistant anything. /sources shows what it found, /as <email> chats as a customer, /new starts over, /exit quits.\n')

  for (;;) {
    const question = (await rl.question('You: ')).trim()
    if (!question) continue
    if (question === '/exit') break
    if (question === '/new') {
      messages = []
      console.log('(new conversation)\n')
      continue
    }
    if (question === '/as' || question.startsWith('/as ')) {
      const email = question.slice(3).trim().toLowerCase()
      if (!email) {
        asUser = undefined
        console.log('(chatting as a visitor)\n')
        continue
      }
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true } })
      if (!user) console.log(`(no account uses ${email})\n`)
      else {
        asUser = { id: user.id, email: user.email, role: user.role }
        messages = []
        console.log(`(chatting as ${user.email}${user.role === 'USER' ? '' : ` (${user.role.toLowerCase()})`}; new conversation)\n`)
      }
      continue
    }
    if (question === '/sources') {
      showSources = !showSources
      console.log(`(sources ${showSources ? 'on' : 'off'})\n`)
      continue
    }

    messages.push({ role: 'user', text: question })
    const started = Date.now()
    try {
      if (showSources) {
        const userTexts = messages.filter((m) => m.role === 'user').slice(-2).map((m) => m.text).join('\n')
        for (const h of await searchKnowledge(userTexts)) console.log(`  · ${h.distance.toFixed(3)}  ${h.sourceType}  ${h.title}`)
      }
      const answer = await reply({ messages: messages.slice(-10) }, asUser)
      messages.push({ role: 'assistant', text: answer.text })
      console.log(`\nAssistant: ${answer.text}`)
      for (const link of answer.links ?? []) console.log(`  → ${link.label}: ${link.to}`)
      console.log(`  (${((Date.now() - started) / 1000).toFixed(1)} s)\n`)
    } catch (error) {
      messages.pop()
      const message = error instanceof ChatError ? error.message : error instanceof Error ? error.message : String(error)
      console.log(`\n(failed after ${((Date.now() - started) / 1000).toFixed(1)} s: ${message})\n`)
    }
  }
  rl.close()
  await prisma.$disconnect()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
