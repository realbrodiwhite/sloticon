const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

/**
 * Calculates experience points based on game outcomes.
 * This is a placeholder function and needs to be implemented
 * based on your game's specific logic for awarding XP.
 *
 * @param {string} userId The ID of the user.
 * @param {object} gameOutcome An object containing details of the game outcome (e.g., { win: boolean, score: number, duration: number, gameId: string }).
 * @returns {number} The calculated experience points.
 */
function calculateExperience(userId, gameOutcome) {
  console.log(`Calculating XP for user ${userId} with outcome:`, gameOutcome);

  let earnedExperience = 0;

  // Basic XP calculation based on win/loss
  if (gameOutcome.win) {
    earnedExperience += 50; // Award base XP for winning
    // Add bonus XP based on score (example: 1 XP per 100 score)
    earnedExperience += Math.floor((gameOutcome.score || 0) / 100);
    // Add bonus XP based on game duration (example: 1 XP per 10 seconds)
    earnedExperience += Math.floor((gameOutcome.duration || 0) / 10);
  } else {
    earnedExperience += 10; // Award small XP for participating (loss)
    // Still award some XP based on score and duration in case of loss
    earnedExperience += Math.floor((gameOutcome.score || 0) / 200);
    earnedExperience += Math.floor((gameOutcome.duration || 0) / 20);
  }

  return earnedExperience;
}

/**
 * Checks if a user has leveled up based on their new experience points
 * and updates their level and experience in the database.
 *
 * @param {string} userId The ID of the user.
 * @param {number} newExperience The user's total experience after the game.
 */
async function handleLevelUp(userId, newExperience) {
  const userRef = db.collection('users').doc(userId);

  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    if (!doc.exists) {
      throw new Error("User does not exist!");
    }

    const userData = doc.data() || { level: 1, experience: 0 }; // Handle case where user data might be empty initially
    let currentLevel = userData.level;
    let updatedExperience = newExperience;

    let updatedLevel = currentLevel;

    // Example: level up every 500 experience points
    // A more realistic system would use a function to determine XP needed for the next level
    const experiencePerLevel = 500; 
    while (updatedExperience >= currentLevel * experiencePerLevel) {
      // You might deduct experience for the level up or just continue accumulating
      // For simplicity here, we just increment level
      currentLevel = updatedLevel; // Update currentLevel to check for further level ups in this transaction
    }

    if (updatedLevel > userData.level) {
      console.log(`User ${userId} leveled up to level ${updatedLevel}`);
      transaction.update(userRef, {
        level: updatedLevel,
        experience: updatedExperience
      });
      // TODO: Trigger any level up rewards or notifications
    } else {
      transaction.update(userRef, {
        experience: updatedExperience
      });
    }

    return updatedLevel; // Return the updated level
  });
}


/**
 * Updates leaderboard data based on a user's new level and experience.
 *
 * @param {string} userId The ID of the user.
 * @param {number} level The user's current level.
 * @param {number} experience The user's current experience.
 */
async function updateLeaderboard(userId, level, experience) {
  console.log(`Updating leaderboard for user ${userId} with level ${level} and experience ${experience}`);

  // Reference to the global leaderboard document
  // You might have different leaderboards (e.g., daily, weekly)
  const leaderboardRef = db.collection('leaderboard').doc('global');
  
  // Get the current leaderboard data
  const leaderboardDoc = await leaderboardRef.get();
  const leaderboardData = leaderboardDoc.exists ? leaderboardDoc.data() : {};

  // Update the user's entry. Rank by level, then experience.
  const userLeaderboardData = {
    [userId]: {
      level: level,
      experience: experience,
      // You might also include username or other relevant user info (fetch from user document if needed)
    }
  };
  await leaderboardRef.set(userLeaderboardData, { merge: true }); // Use merge to add/update the user's entry without overwriting the whole document
}

/**
 * Retrieves a user's level and experience.
 *
 * @param {object} data The request data, expected to contain userId.
 * @param {object} context The Cloud Functions context.
 * @returns {Promise<object>} An object containing the user's level and experience.
 */
exports.getUserProgress = functions.https.onCall(async (data, context) => {
  const userId = data.userId;

  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'User ID is required.');
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found.');
    }
    const userData = userDoc.data();
    return {
      level: userData.level || 1,
      experience: userData.experience || 0
    };
  } catch (error) {
    console.error("Error retrieving user progress:", error);
    throw new functions.https.HttpsError('internal', 'Unable to retrieve user progress.', error);
  }
});
}


// Example Cloud Function triggered after a game is finished
// You would need to call this function from your game server or client
// passing the userId and gameOutcome.
exports.processGameOutcome = functions.firestore.document('gameSessions/{sessionId}')
  .onUpdate(async (change, context) => {
    const sessionData = change.after.data();
    const previousSessionData = change.before.data();

    // Ensure the game has finished and outcome is available
    if (sessionData.status === 'finished' && previousSessionData.status !== 'finished') {
      const userId = sessionData.userId;
      const gameOutcome = sessionData.outcome; // Assuming 'outcome' field exists in your game session document

      if (!userId || !gameOutcome) {
        console.error("Missing userId or gameOutcome in game session data.");
        return null;
      }

      try {
        // 1. Calculate XP
        const earnedExperience = calculateExperience(userId, gameOutcome);

        // Get current user data to calculate new total experience
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
          console.error(`User ${userId} not found.`);
          return null;
        }
        const userData = userDoc.data();
        const currentExperience = userData.experience || 0;
        const newTotalExperience = currentExperience + earnedExperience;

        // 2. Handle Level Up and Update User Experience
        const updatedLevel = await handleLevelUp(userId, newTotalExperience);
        const updatedUserDoc = await userRef.get(); // Get the updated user document
        const updatedUserData = updatedUserDoc.data();

        // 3. Update Leaderboard
        await updateLeaderboard(userId, updatedUserData.level, updatedUserData.experience);

        console.log(`Successfully processed game outcome for user ${userId}.`);
        return null;

      } catch (error) {
        console.error("Error processing game outcome:", error);
        // TODO: Implement error handling and potentially retry mechanisms
        return null;
      }
    }

    return null; // Do nothing if the game session is not finished
  });

/**
 * Retrieves leaderboard data.
 *
 * @param {object} data The request data, can optionally contain a 'limit' for the number of entries.
 * @param {object} context The Cloud Functions context.
 * @returns {Promise<object>} An object containing leaderboard data.
 */
exports.getLeaderboard = functions.https.onCall(async (data, context) => {
  const limit = data.limit || 10; // Default to 10 entries if limit is not provided

  try {
    // For a simple global leaderboard stored as a single document,
    // we retrieve the document and format the data.
    const leaderboardDoc = await db.collection('leaderboard').doc('global').get();
    if (!leaderboardDoc.exists) {
      return { entries: [] };
    }

    const leaderboardData = leaderboardDoc.data();
    // Convert the object into an array of entries and sort them (e.g., by level descending, then experience descending)
    const sortedEntries = Object.entries(leaderboardData)
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => {
        if (b.level !== a.level) {
          return b.level - a.level; // Sort by level descending
        }
        return b.experience - a.experience; // Then by experience descending
      })
      .slice(0, limit); // Apply the limit

    // You might want to fetch usernames for these userIds if not stored in the leaderboard document

    return { entries: sortedEntries };
  } catch (error) {
    console.error("Error retrieving leaderboard:", error);
    throw new functions.https.HttpsError('internal', 'Unable to retrieve leaderboard data.', error);
  }
});