import express from 'express'

const app = express()
app.use(express.json())

app.get('/', (req, res) => {
  res.send('Hafletna API is running!')
})

app.listen(3000, () => {
  console.log('Server running on port 3000')
})

export default app