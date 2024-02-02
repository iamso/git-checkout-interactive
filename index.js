#!/usr/bin/env node

const { promisify } = require('util')
const exec = promisify(require('child_process').exec)
const prompts = require('prompts')
const kleur = require('kleur')

async function run () {
  // exit if this is not a git repo
  try {
    await exec('git rev-parse --git-dir > /dev/null 2>&1')
  } catch(err) {
    logError('Not a git repo')
    process.exit(1)
  }

  // get branches
  const { stdout: branches } = await exec('git branch -v --sort=-committerdate')
  const choices = branches
    .split(/\n/)
    .filter(branch => !!branch.trim())
    .map(branch => {
      const [, flag, value, hint] = branch.match(/([* ]) +([^ ]+) +(.+)/)
      return { value, hint, disabled: flag === '*' }
    })

  // exit if there isn't more than 1 branch
  if (choices.length <= 1) {
    logError('No branches to select')
    process.exit(1)
  }

  const { branch } = await prompts({
    type: 'select',
    name: 'branch',
    message: 'Switch branch',
    choices,
    hint: choices[0].hint,
    warn: 'current branch',
    onState (state) {
      this.hint = choices.find(c => c.value === state.value).hint
      onAbort(state)
    }
  })

  await checkout(branch)
}

async function checkout (branch) {
  if (!branch) return
  const { stdout, stderr } = await exec(`git checkout ${branch}`)
  process.stdout.write(stdout)
  process.stderr.write(stderr)
}

function logSuccess(text, newLine = false) {
  newLine && console.log()
  console.log(kleur.green().bold(text))
}

function logError(text, newLine = false) {
  newLine && console.log()
  console.log(kleur.red().bold(text))
}

function onAbort(state) {
  if (state.aborted) {
    process.nextTick(() => {
      logSuccess('Ok bye \\_(-_-)_/', true)
      process.exit(0);
    })
  }
}

function onError (e) {
  if (e.stderr) {
    process.stderr.write(e.stderr)
  } else {
    console.error(e)
  }
}

run().catch(onError)

process.on('SIGINT', () => {
  onAbort({ aborted: true })
});
