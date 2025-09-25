-- Insère des utilisateurs de test
INSERT INTO users (username, password_hash, credits) VALUES
  ('admin', '1234', 1000),
  ('joueur1', 'azerty', 500),
  ('joueur2', 'test', 200);

-- Exemple de parties jouées
INSERT INTO games (user_id, game_type, bet, result) VALUES
  (1, 'roulette', 100, 'win'),
  (2, 'slots', 50, 'lose'),
  (3, 'roulette', 20, 'win');
