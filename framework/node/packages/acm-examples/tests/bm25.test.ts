// Tests for BM25 search functionality
import { BM25Search } from '../src/search/bm25.js';

async function testIndexAndSearch() {
  console.log('Testing index and search...');
  
  const documents = [
    { id: 'doc1', content: 'The quick brown fox jumps over the lazy dog' },
    { id: 'doc2', content: 'A fast brown fox leaps over a sleepy dog' },
    { id: 'doc3', content: 'The cat sits on the mat' },
  ];

  const search = new BM25Search();
  search.index(documents);

  const results = search.search('brown fox');
  
  if (results.length === 0) {
    throw new Error('Expected results, got none');
  }
  
  if (!['doc1', 'doc2'].includes(results[0].document.id)) {
    throw new Error(`Expected doc1 or doc2, got ${results[0].document.id}`);
  }
  
  console.log('✅ Index and search test passed');
}

async function testEmptyQuery() {
  console.log('Testing empty query...');
  
  const documents = [{ id: 'doc1', content: 'Test document' }];
  const search = new BM25Search();
  search.index(documents);
  
  const results = search.search('');
  
  if (results.length !== 0) {
    throw new Error('Expected empty results for empty query');
  }
  
  console.log('✅ Empty query test passed');
}

async function testRanking() {
  console.log('Testing ranking...');
  
  const documents = [
    { id: 'doc1', content: 'machine learning algorithms' },
    { id: 'doc2', content: 'learning machine code' },
    { id: 'doc3', content: 'deep learning neural networks' },
  ];

  const search = new BM25Search();
  search.index(documents);

  const results = search.search('machine learning');
  
  if (results.length < 2) {
    throw new Error('Expected at least 2 results');
  }
  
  if (results[0].score < results[1].score) {
    throw new Error('Results not properly ranked');
  }
  
  console.log('✅ Ranking test passed');
}

async function testLimitParameter() {
  console.log('Testing limit parameter...');
  
  const documents = Array.from({ length: 10 }, (_, i) => ({
    id: `doc${i}`,
    content: `Document ${i} with test content`,
  }));

  const search = new BM25Search();
  search.index(documents);

  const results = search.search('test', 3);
  
  if (results.length > 3) {
    throw new Error(`Expected max 3 results, got ${results.length}`);
  }
  
  console.log('✅ Limit parameter test passed');
}

async function runTests() {
  console.log('Running BM25 Search Tests\n');
  console.log('='.repeat(50));

  const tests = [
    testIndexAndSearch,
    testEmptyQuery,
    testRanking,
    testLimitParameter,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      console.error(`❌ Test failed: ${error}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  return failed === 0;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

