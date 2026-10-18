const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('webapp/frontend/js/puzzles.js', 'utf8');
vm.runInNewContext(source + `
let generated = 0;
for (const type of GAME_ORDER) {
  const fingerprints = new Set();
  for (let level = 1; level <= 100; level++) {
    const config = levelConfig(level, type);
    const game = createPuzzle(type, config.difficulty, level, null);
    const again = createPuzzle(type, config.difficulty, level, null);
    const stable = obj => JSON.stringify({...obj, startedAt: 0});
    assert.equal(stable(game), stable(again), type + ': reproducible campaign');
    fingerprints.add(stable(game));
    assert.equal(game.levelNumber, level);
    if (type === 'sudoku') {
      assert.equal(countSolutions([...game.board]), 1, 'unique Sudoku');
      assert.equal(sudokuConflicts(game.solution).size, 0);
      assert.ok(game.board.every((n,i) => !n || n === game.solution[i]));
    }
    if (type === 'nonogram') assert.equal(countNonogramSolutions(game.rowClues,game.colClues),1,'unique nonogram');
    if (type === 'memory') {
      for (const value of new Set(game.cards.map(c=>c.value))) assert.equal(game.cards.filter(c=>c.value===value).length,2);
    }
    if (type === 'tiles') {
      let inversions=0; const nums=game.board.filter(Boolean);
      nums.forEach((v,i)=>nums.slice(i+1).forEach(w=>{if(v>w)inversions++;}));
      const row=game.size-Math.floor(game.board.indexOf(0)/game.size);
      assert.equal(game.size%2 ? inversions%2 : (inversions+row)%2,game.size%2 ? 0 : 1,'solvable sliding puzzle');
      assert.ok(!game.board.every((v,i)=>v===(i+1)%game.board.length));
    }
    if (type === 'arithmetic') {
      for (const q of game.questions) {
        const expression=q.question.replace(' = ?','').replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-');
        assert.match(expression,/^[0-9+*\/(). -]+$/);
        assert.equal(Number(q.answers[0]),Function('return ('+expression+')')());
      }
    }
    if (type === 'pattern') game.patterns.forEach(pattern=>assert.equal(new Set(pattern).size,pattern.length));
    if (type === 'stroop') game.questions.forEach(q=>assert.notEqual(q.word,q.ink));
    if (game.questions && type !== 'stroop') game.questions.forEach(q=>assert.ok(q.question && q.hint && q.answers.length));
    generated++;
  }
  assert.equal(fingerprints.size,100,type + ': 100 distinct stages');
  console.log(type+': 100 stages OK');
}
console.log('Generated and checked '+generated+' stages.');
`, { console, assert }, { timeout: 120000 });
