import { GameFullState, GameQuestion } from "../types/game";

export const gameEngine = {
  formatQuestion(q: GameQuestion) {
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

  mapLeaderboard(leaderboard: any[], players: any) {
    return leaderboard.map((p) => ({
      playerId: p.value,
      nickname: players[p.value],
      score: p.score,
    }));
  },

  buildPlayerView(gameState: GameFullState, userId: string) {
    const { meta, players, leaderboard, question, answers } = gameState;
    const playerAnswer = answers?.[userId];

    switch (meta.phase) {
      case "question":
        return {
          phase: "question",
          data: {
            question: question?.question,
            hasAnswered: playerAnswer !== undefined,
          },
        };

      case "results":
        return {
          phase: "results",
          data: {
            isCorrect:
              playerAnswer !== undefined
                ? question?.correctIndexes.includes(Number(playerAnswer)) // todo: fix
                : null,
          },
        };

      case "leaderboard":
        return {
          phase: "leaderboard",
          data: this.mapLeaderboard(leaderboard, players),
        };

      default:
        return { phase: meta.phase, data: {} };
    }
  },

  buildHostView(gameState: GameFullState) {
    const { meta, players, leaderboard, question, answers } = gameState;

    switch (meta.phase) {
      case "question":
        return {
          phase: "question",
          data: {
            currentQuestion: meta.currentQuestion,
            questionCount: meta.questionCount,
            question: question?.question,
            answers: question?.answers,
            timeLimit: question?.timeLimit,
            answeredCount: answers ? Object.keys(answers).length : 0,
          },
        };

      case "results":
        return {
          phase: "results",
          data: {
            answers: answers,
            correctAnswers: question?.correctIndexes,
            distribution: this.buildDistribution(
              answers || {},
              question?.answers.length || 0,
            ),
          },
        };

      case "leaderboard":
        return {
          phase: "leaderboard",
          data: this.mapLeaderboard(leaderboard, players),
        };

      default:
        return { phase: meta.phase, data: {} };
    }
  },
};
