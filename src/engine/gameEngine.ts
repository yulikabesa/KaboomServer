export const gameEngine = {
  formatQuestion(q: any) {
    return {
      question: q.question,
      answers: q.answers,
      timeLimit: q.timeLimit,
    };
  },

  calculateScore(correctIndexes: number[], answer: number) {
    if (correctIndexes.includes(answer)) {
      return 1000;
    }
    return 0;
  },

  buildDistribution(answers: Record<string, string>, answerCount: number) {
    const counts = new Array(answerCount).fill(0);
    for (const answer of Object.values(answers)) {
      counts[Number(answer)]++;
    }

    return counts;
  },
};
