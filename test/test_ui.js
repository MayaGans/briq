'use strict'

const assert = require('assert')
const {JSDOM} = require('jsdom')

const util = require('../libs/util')
const MISSING = util.MISSING
const {DataFrame} = require('../libs/dataframe')
const {Expr} = require('../libs/expr')
const {Stage} = require('../libs/stage')
const {Pipeline} = require('../libs/pipeline')
const {Program} = require('../libs/program')
const {JsonToObj} = require('../libs/json2obj')
const {HtmlToJson} = require('../libs/html2json')
const {UserInterface} = require('../libs/ui')
const fixture = require('./fixture')

let MostRecentPlot = null
const ShowPlot = (spec) => {
  MostRecentPlot = spec
}

let DOM = null
let document = null
const reset = () => {
  DOM = new JSDOM('<body></body>')
  document = DOM.window.document
  const body = document.querySelector('body')

  const programArea = `<div id="programArea"></div>`
  
  const toolboxDivs = [
    'exprTab',
    'transformTab',
  ].map(id => `<div id="${id}"></div>`).join('')

  const displayDivs = [
    'dataArea',
    'resultsArea',
    'plotArea',
    'statisticsArea',
    'logArea',
    'errorArea'
  ].map(id => `<div id="${id}" data-briq-tabgroup="display"></div>`).join('')

  const displayButtons = [
    'dataButton',
    'resultsButton',
    'plotButton',
    'statisticsButton',
    'logButton',
    'errorButton'
  ].map((id, i) => {
    const buttonDefault = (i === 0) ? 'class="buttonDefault"' : ''
    return `<button id="${id}" ${buttonDefault} data-briq-buttongroup="display"></button>`
  }).join('')

  const selectors = [
    'dataSelect',
    'resultsSelect'
  ].map(id => `<select id="${id}"></select>`).join('')

  body.innerHTML = [
    programArea,
    toolboxDivs,
    displayDivs,
    selectors,
    displayButtons
  ].join('')
  return new UserInterface(document, fixture.ReadLocalData, ShowPlot)
}

describe('UI infrastructure', () => {
  it('only makes toolboxes it knows about', (done) => {
    const ui = reset()
    assert.throws(() => ui.makeToolbox('something'),
                  Error,
                  `Should not be able to make unknown toolbox`)
    done()
  })

  it('makes an empty program', (done) => {
    const ui = reset()
    const html = ui.makeEmptyProgram()
    done()
  })
})

describe('make blank expressions', () => {
  it('makes blank expressions', (done) => {
    const blanks = Expr.makeBlanks()
    done()
  })

  it('puts blank expressions in a table', (done) => {
    const ui = reset()
    const table = ui.makeToolbox('expr')
    done()
  })
})

describe('make blank stages', () => {
  it('makes blank stages', (done) => {
    const blanks = Stage.makeBlanks()
    done()
  })

  it('puts blank stages in a table', (done) => {
    const ui = reset()
    const table = ui.makeToolbox('stage')
    done()
  })
})

describe('loads things', () => {
  it('loads data', (done) => {
    const ui = reset()
    const name = 'something.csv'
    const data = 'left,right\n1,10\n2,20'
    ui.loadData(name, data)

    assert(ui.data.has(name),
           `Data not registered`)

    const loaded = ui.data.get(name)
    assert(loaded instanceof DataFrame,
           `Expected dataframe`)
    assert(loaded.equal(new DataFrame([{left: 1, right: 10},
                                       {left: 2, right: 20}])),
           `Dataframe loaded incorrectly`)

    const selector = document.getElementById('dataSelect')
    assert.equal(selector.children.length, 1,
                 `Should have one selectable dataset`)
    const option = selector.querySelector('option[selected="selected"]')
    assert.equal(option.getAttribute('value'), name,
                 `Selection has wrong value`)
    const dataArea = document.getElementById('dataArea')
    assert.equal(dataArea.children.length, 1,
                 `Data area should have one child`)
    assert.match(dataArea.firstChild.tagName, /table/i,
                 `Data area should contain a table`)

    done()
  })

  it('loads programs', (done) => {
    const ui = reset()
    const name = 'something.briq'
    const text = '["@program", ["@pipeline", ["@stage", "read", "something.csv"]]]'
    const programBefore = JSON.parse(text)

    const programArea = document.getElementById('programArea')
    assert.equal(programArea.children.length, 1,
                 `Program area should have one child before loading`)

    const tableBefore = programArea.firstChild
    assert.match(tableBefore.tagName, /table/i,
                 `Program area child should be table`)
    assert.equal(programArea.querySelectorAll('tr').length, 1,
                 `Empty program should contain one row`)
    assert.equal(programArea.querySelectorAll('th').length, 1,
                 `Empty program should contain one heading`)
    assert.equal(programArea.querySelectorAll('td').length, 1,
                 `Empty program should contain one cell`)
    assert.equal(programArea.querySelector('td').getAttribute('class'), 'briq-placeholder',
                 `Table cell before loading should be placeholder`)

    ui.loadProgram(name, text)

    const expected = new Program(new Pipeline(new Stage.read('something.csv')))
    assert(expected.equal(ui.program),
           `Loaded program does not match expected program`)

    assert.equal(programArea.children.length, 1,
                 `Program area should have one child after loading`)

    const tableAfter = programArea.firstChild
    const programAfter = (new HtmlToJson()).program(tableAfter)
    assert.deepEqual(programAfter, programBefore,
                     `Loaded program does not match initial program`)

    done()
  })
})

describe('displays things', () => {
  it('can select every display tab', (done) => {
    const allCases = [
      ['dataButton', 'dataArea', 'data'],
      ['resultsButton', 'resultsArea', 'results'],
      ['plotButton', 'plotArea', null],
      ['statisticsButton', 'statisticsArea', null],
      ['logButton', 'logArea', null],
      ['errorButton', 'errorArea', null]
    ].forEach(([buttonId, tabId, selectorId]) => {
      const ui = reset()
      const thisButton = document.getElementById(buttonId)
      ui.showTab(thisButton, tabId, selectorId)

      assert(Array.from(document.querySelectorAll('button[data-briq-buttongroup="display"]'))
             .every(button => {
               return (button.getAttribute('id') === buttonId)
                 ? button.classList.contains('active')
                 : !button.classList.contains('active')
             }), `Expected only clicked button to be active`)

      assert(Array.from(document.querySelectorAll('div[data-briq-tabgroup="display"]'))
             .every(div => {
               return (div.getAttribute('id') === tabId)
                 ? (div.style.display === 'block')
                 : (div.style.display === 'none')
             }), `Expected only selected tab to be displayed`)
    })
    done()
  })

  it('displays the selected data set', (done) => {
    const ui = reset()
    const firstText = 'red,green\n1,2\n'
    ui.loadData('first', firstText)
    const secondText = 'black,white\n10,20\n'
    ui.loadData('second', secondText)
    assert(ui.data.has('first') && ui.data.has('second'),
           `Datasets not remembered`)

    const selector = document.getElementById('dataSelect')
    assert.equal(selector.children.length, 2,
                 `Should have two selectable datasets`)

    const firstOption = selector.querySelector('option[value="first"]')
    assert.equal(firstOption.getAttribute('selected'), null,
                 `First dataset should not be selected`)

    const secondOption = selector.querySelector('option[value="second"]')
    assert.equal(secondOption.getAttribute('selected'), 'selected',
                 `Second dataset should be selected`)

    const div = document.getElementById('dataArea')
    const initialTable = div.querySelector('table')
    assert.equal(initialTable.getAttribute('briq-data-tablename'), 'second',
                 `Second table should be displayed`)

    firstOption.setAttribute('selected', 'selected')
    secondOption.removeAttribute('selected')
    ui.displayTable('data')

    const finalTable = div.querySelector('table')
    assert.equal(finalTable.getAttribute('briq-data-tablename'), 'first',
                 `First table should be displayed`)

    done()
  })

  it('displays a plot', (done) => {
    const ui = reset()
    const spec = {'testing': true}
    ui.displayPlot(spec)
    assert.deepEqual(MostRecentPlot, {'testing': true, width: 500, height: 300},
                     `Plot not created correctly`)
    done()
  })

  it('displays statistics', (done) => {
    const ui = reset()
    const legend = {_title: 'testing',
                    something: 'why'}
    const results = {something: 1.1}
    ui.displayStatistics(results, legend)

    const statisticsArea = document.getElementById('statisticsArea')
    assert.equal(statisticsArea.querySelectorAll('p').length, 1,
                 `Should have one paragraph`)
    assert.equal(statisticsArea.querySelector('p').textContent, 'testing',
                 `Title has wrong text`)

    assert.equal(statisticsArea.querySelectorAll('table').length, 1,
                 `Should contain one table`)
    const table = statisticsArea.querySelector('table[class="statistics"]')
    assert(table,
           `Table should be of class 'statistics'`)
    assert.equal(table.querySelectorAll('tr').length, 2,
                 `Table should contain two rows`)
    const secondRow = table.querySelectorAll('tr')[1]
    const text = Array.from(secondRow.querySelectorAll('td'))
          .map(node => node.textContent)
    assert.equal(text[0], 'something',
                 `First element should contain key`)
    assert.equal(parseFloat(text[1]), 1.1,
                 `Second element should contain value`)
    assert.equal(text[2], 'why',
                 `Third element should contain explanation`)

    done()
  })

  it('displays log and error messages', (done) => {
    const ui = reset()
    const words = ['first', 'second', 'third']

    ui.displayLog(words)

    const oldFunc = console.log
    console.log = (...args) => {}
    ui.displayError(words)
    console.log = oldFunc

    for (const area of ['logArea', 'errorArea']) {
      const div = document.getElementById(area)
      assert.equal(div.children.length, 1,
                   `Area should contain one list`)
      const list = div.firstChild
      assert.match(list.tagName, /ol/i,
                   `Message list should be ordered list`)
      assert.equal(list.children.length, 3,
                   `Message list should have three entries`)
      assert(words.every((word, i) => list.children[i].textContent === word),
             `Wrong words in list`)
    }
    done()
  })
})

describe('runs programs', () => {
  it('runs a correct program that does not notify', (done) => {
    const ui = reset()

    const program = new Program(new Pipeline(new Stage.read('colors.csv')))
    const programText = JSON.stringify(program.toJSON())
    ui.loadProgram('program.briq', programText)

    ui.runProgram()

    const resultsSelect = document.getElementById('resultsSelect')
    assert.equal(resultsSelect.children.length, 1,
                 `Results selector should have one child`)
    assert.equal(resultsSelect.firstChild.textContent, '-none-',
                 `Results selector should be set to empty`)

    const logs = document.getElementById('logArea').querySelectorAll('li')
    assert.equal(logs.length, 1,
                 `Should not be one log message`)
    assert.match(logs[0].textContent, /read/i,
                 `Log message should show a file being read`)

    const errors = document.getElementById('errorArea').querySelectorAll('li')
    assert.equal(errors.length, 0,
                 `Should not be any errors`)

    done()
  })

  it('reports an error when running a nonexistent program', (done) => {
    const ui = reset()
    ui.runProgram()
    const errors = document.getElementById('errorArea').querySelectorAll('li')
    assert.equal(errors.length, 1,
                 `Should not be any errors`)
    assert.match(errors[0].textContent, /No program available/i,
                 `Should report no program available`)
    done()
  })
})
