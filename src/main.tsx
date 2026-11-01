import { render } from 'preact'
import { App } from './app.tsx'
import { init } from './store.ts'
import './styles.css'

render(<App />, document.getElementById('app')!)
void init()
