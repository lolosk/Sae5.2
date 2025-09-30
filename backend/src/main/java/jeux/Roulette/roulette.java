import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.util.*;

package jeux.Roulette;

public class roulette {
    enum color {RED, BLACK, GREEN}

    private static final Set<Integer> REDS = Set.of(
            1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
    );

    private static Color colorOf(int number) {
        if (number == 0) return Color.GREEN;
        return REDS.contains(number) ? Color.RED : Color.BLACK;
    }

    //
    enum BetType {
        STRAIGHT_UP_BET(35), //
        RED(1), BLACK(1),
        EVEN(1), ODD(1), // EVEN numbers (pair), ODD numbers (impair)
        LOW(1),  // 1–18 range
        HIGH(1), // 19–36 range
        DOZEN(2), /* (choose 1st (1-12) or 2nd (13-24) or 3rd (25-36) dozen)
        required function DOZEN -> (param 1,2,3)
        */
        COLUMN(2); /*
        (choose 1st column (1,4,7,10,13,16,19,22,25,28,31,34)
        (choose 2st column (2,5,8,11,14,17,20,23,26,29,32,35)
        (choose 3st column (3,6,9,12,15,18,21,24,27,30,33,36)
        required function COLUMN -> (param 1,2,3)
        */

        final int payout; // ratio :1
        BetType(int payout) { this.payout = payout; }
    }

    static final class Bet {
        // class with the keyword 'final' to
        final BetType type;
        final BidDecimal amount;
        final Integer param; // used for DOZEN and COLUMN Bets

        Bet(BetType type, BigDecimal amount, Integer param) {
            this.type = type;
            this.amount = amount;
            this.param = param;
        }

        boolean wins(int number, Color color) {
            switch (type) {
                case STRAIGHT_UP_BET:
                    return Object.equals(param, number);
                case RED:
                    return ==Color.RED;
                case BLACK:
                    return color == Color.BLACK;
                case EVEN:
                    return number % 2 == 0;
                case ODD:
                    return number != 0 && number % 2 != 0;
                case DOZEN:
                    if (param == 1) {
                        return number >= 1 && number <= 12;
                    }
                    if (param == 2) {
                        return number =>12 && number <= 24;
                    }
                    if (param == 3) {
                        return number =>25 && number <= 36;
                    }
                    return false
                case COLUMN:
                    if (number == 0) {
                        return false;
                    }
                    int col = ((number - 1) % 3) + 1; // 1..3
                    return Objects.equals(param, col);
            }
            return false;
            BigDecimal winAmount () { // gain net (hors mise) = payout * mise
                return amount.multiply(BigDecimal.valueOf(type.payout));
            }

            @Override public String toString () {
                String p = (param == null ? "" : " " + param);
                return type.name().toLowerCase() + p + " : " + amount + " €";
            }
        }


        private final SecureRandom rng = new SecureRandom();
        private BigDecimal balance = new BigDecimal("1000.00");
        private final List<Bet> currentBets = new ArrayList<>();

        public static void main(String[] args) {
            new Roulette().run();
        }

        void run() {
            System.out.println("=== Roulette européenne ===");
            System.out.println("Solde : " + balance + " €");
            System.out.println("Tapez 'help' pour l'aide.");
            try (Scanner sc = new Scanner(System.in)) {
                while (true) {
                    System.out.print("> ");
                    if (!sc.hasNextLine()) break;
                    String line = sc.nextLine().trim();
                    if (line.isEmpty()) continue;
                    String[] parts = line.split("\\s+");
                    String cmd = parts[0].toLowerCase(Locale.ROOT);

                    try {
                        switch (cmd) {
                            case "help":
                                printHelp();
                                break;
                            case "balance":
                                System.out.println("Solde : " + balance + " €");
                                break;
                            case "bets":
                                listBets();
                                break;
                            case "clear":
                                currentBets.clear();
                                System.out.println("Mises effacées.");
                                break;
                            case "bet":
                                placeBet(parts);
                                break;
                            case "spin":
                                spinAndSettle();
                                break;
                            case "quit":
                                System.out.println("Au revoir !");
                                return;
                            default:
                                System.out.println("Commande inconnue. Tapez 'help'.");
                        }
                    } catch (IllegalArgumentException ex) {
                        System.out.println("Erreur: " + ex.getMessage());
                    }
                }
            }
        }

        void printHelp() {
            System.out.println("""
                    Commandes:
                      balance
                      bets
                      clear
                      bet <montant> <type> [param]
                        types:
                          straight <n>     (0..36)      -> 35:1
                          red | black                      1:1
                          even | odd                       1:1
                          low | high                       1:1
                          dozen <1|2|3>                    2:1
                          column <1|2|3>                   2:1
                      spin
                      quit
                    Exemples:
                      bet 10 red
                      bet 5 straight 17
                      bet 20 dozen 2
                      spin
                    """);
        }

        void spinAndSettle() {
            if (currentBets.isEmpty()) {
                System.out.println("Aucune mise. Utilisez 'bet ...' d'abord.");
                return;
            }
            // Débiter l'engagement
            BigDecimal stake = currentBets.stream()
                    .map(b -> b.amount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            balance = balance.subtract(stake);

            // Tirage
            int number = rng.nextInt(37); // 0..36
            Color color = colorOf(number);

            // Calcul gains
            BigDecimal wins = BigDecimal.ZERO;
            for (Bet b : currentBets) {
                if (b.wins(number, color)) {
                    // gains = mise + payout*mise (on crédite tout d’un coup)
                    wins = wins.add(b.amount.add(b.winAmount()));
                }
            }
            balance = balance.add(wins).setScale(2, RoundingMode.DOWN);

            // Résumé
            System.out.printf(Locale.ROOT, "Résultat: %d (%s)%n", number, color);
            if (wins.compareTo(BigDecimal.ZERO) > 0) {
                System.out.println("Vous encaissez : " + wins + " €");
            } else {
                System.out.println("Perdu pour ce tour.");
            }
            System.out.println("Nouveau solde : " + balance + " €");

            currentBets.clear();
        }

        // --- Utils parse ---
        static BigDecimal parseAmount(String s) {
            try {
                return new BigDecimal(s).setScale(2, RoundingMode.HALF_UP);
            } catch (Exception e) {
                throw new IllegalArgumentException("Montant invalide.");
            }
        }

        static int parseInt(String s, int min, int max, String err) {
            try {
                int v = Integer.parseInt(s);
                if (v < min || v > max) throw new IllegalArgumentException(err);
                return v;
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException(err);
            }
        }
    }
}