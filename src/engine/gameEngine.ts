import { GameFullState, Player, UserAnswer } from "../types/game";

export const gameEngine = {
  isAnswerCorrect(correctIndexes: number[], playerAnswer: number[]) {
    const correctSet = new Set(correctIndexes);
    return (
      playerAnswer.length === correctSet.size &&
      playerAnswer.every((i) => correctSet.has(i))
    );
  },

  calculateScore(
    correctIndexes: number[],
    playerAnswer: number[],
    scoringWeight: number,
  ) {
    const SCORE = 1000;
    if (this.isAnswerCorrect(correctIndexes, playerAnswer)) {
      return SCORE * scoringWeight;
    }
    return 0;
  },

  buildDistribution(answers: Record<string, UserAnswer>, answerCount: number) {
    const counts = new Array(answerCount).fill(0);

    for (const answer of Object.values(answers)) {
      for (const index of answer.indexes) {
        counts[index]++;
      }
    }

    return counts;
  },

  mapLeaderboard(leaderboard: any[], players: Record<string, Player>) {
    return leaderboard.map((p) => ({
      nickname: players[p.value].nickname,
      score: p.score,
    }));
  },

  // Build the view that all players in a game can see
  buildSharedPlayerView(gameState: GameFullState) {
    const { meta, question } = gameState;

    switch (meta.phase) {
      case "answers":
        return {
          phase: meta.phase,
          data: {
            answers: question?.answers,
          },
        };

      default:
        return { phase: meta.phase, data: null };
    }
  },

  // Build the view for a single player (personal info)
  buildPersonalPlayerView(gameState: GameFullState, userId: string) {
    const { meta, question, players, answers, leaderboard } = gameState;
    const playerAnswer = answers?.[userId];
    const currentRank = players[userId].currentRank;

    switch (meta.phase) {
      case "answers":
        return {
          phase: meta.phase,
          data: {
            hasAnswered: playerAnswer !== undefined,
            answers: question?.answers,
          },
        };

      case "results":
        return {
          phase: meta.phase,
          data: {
            isCorrect:
              playerAnswer !== undefined
                ? this.isAnswerCorrect(
                    question!.correctIndexes,
                    playerAnswer.indexes,
                  )
                : false, // no answer
            currentRank,
            score: currentRank ? leaderboard[currentRank].score : 0,
          },
        };

      case "leaderboard":
        return {
          phase: meta.phase,
          data: {
            isCorrect:
              playerAnswer !== undefined
                ? this.isAnswerCorrect(
                    question!.correctIndexes,
                    playerAnswer.indexes,
                  )
                : false, // no answer
            currentRank: players[userId].currentRank,
            score: currentRank ? leaderboard[currentRank].score : 0,
          },
        };

      default:
        return { phase: meta.phase, data: null };
    }
  },

  buildHostView(gameState: GameFullState) {
    const { meta, players, leaderboard, question, answers } = gameState;

    switch (meta.phase) {
      case "question":
        return {
          phase: meta.phase,
          data: {
            currentQuestion: meta.currentQuestion,
            questionCount: meta.questionCount,
            question: question?.question,
            scoringWeight: question?.scoringWeight,
          },
        };

      case "answers":
        return {
          phase: meta.phase,
          data: {
            question: question?.question,
            answers: question?.answers,
            timeLimit: question?.timeLimit,
            scoringWeight: question?.scoringWeight,
            answeredCount: answers ? Object.keys(answers).length : 0,
          },
        };

      case "results":
        return {
          phase: meta.phase,
          data: {
            answers: question?.answers,
            correctAnswers: question?.correctIndexes,
            distribution: this.buildDistribution(
              answers || {},
              question?.answers.length || 0,
            ),
          },
        };

      case "leaderboard":
        return {
          phase: meta.phase,
          data: this.mapLeaderboard(leaderboard, players),
        };

      default:
        return { phase: meta.phase, data: null };
    }
  },
};
