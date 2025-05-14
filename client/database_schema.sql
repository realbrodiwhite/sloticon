CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL DEFAULT 'Free',
    credits DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    registration_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_date TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    -- Friend and Blocked lists can be implemented with a many-to-many table
    -- Example for Friends: CREATE TABLE user_friends (user_id INT REFERENCES users(user_id), friend_id INT REFERENCES users(user_id), PRIMARY KEY (user_id, friend_id));
    -- Example for Blocked: CREATE TABLE user_blocked (user_id INT REFERENCES users(user_id), blocked_user_id INT REFERENCES users(user_id), PRIMARY KEY (user_id, blocked_user_id));
    -- Or using JSONB for simplicity in this example:
    friends_list JSONB DEFAULT '[]',
    blocked_list JSONB DEFAULT '[]'
);

CREATE TABLE achievements (
    achievement_id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    criteria TEXT,
    reward VARCHAR(255) -- e.g., '100 Credits', 'VIP Status'
);

CREATE TABLE user_achievements (
    user_id INT REFERENCES users(user_id),
    achievement_id INT REFERENCES achievements(achievement_id),
    completion_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE game_configs (
    config_id SERIAL PRIMARY KEY,
    game_name VARCHAR(255) UNIQUE NOT NULL,
    rtp DECIMAL(5, 4), -- Return to Player percentage
    win_frequency DECIMAL(5, 4),
    -- Add other game-specific settings as needed
    settings JSONB
);

CREATE TABLE leaderboards (
    leaderboard_id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    criteria VARCHAR(255) -- e.g., 'highest_credits', 'most_achievements'
);

CREATE TABLE player_progress (
    user_id INT PRIMARY KEY REFERENCES users(user_id),
    level INT NOT NULL DEFAULT 1,
    experience_points INT NOT NULL DEFAULT 0
);