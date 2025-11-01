package com.sae502.servlets;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.BufferedReader;
import java.io.IOException;
import java.sql.SQLException;
import java.util.*;

@WebServlet(urlPatterns = {"/api/blackjack/start", "/api/blackjack/hit", "/api/blackjack/stand"})
public class BlackJackServlet extends HttpServlet {
    private final Gson gson = new Gson();

    static class BJState {
        Deque<String> deck;          // "AS","10H","KC"... (rank + suit)
        List<String> player = new ArrayList<>();
        List<String> dealer = new ArrayList<>();
        int bet;
        String status = "playing";   // playing | player_bust | dealer_bust | player_win | dealer_win | push
        boolean finished = false;
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/json; charset=UTF-8");

        // session/user
        HttpSession s = req.getSession(false);
        if (s == null || s.getAttribute("user") == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"ok\":false,\"error\":\"unauthorized\"}");
            return;
        }
        String username = (String) s.getAttribute("user");

        String path = req.getServletPath(); // /api/blackjack/start | /hit | /stand
        try {
            switch (path) {
                case "/api/blackjack/start": handleStart(req, resp, s, username); break;
                case "/api/blackjack/hit":   handleHit(resp, s, username); break;
                case "/api/blackjack/stand": handleStand(resp, s, username); break;
                default:
                    resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
                    resp.getWriter().write("{\"ok\":false}");
            }
        } catch (SQLException e) {
            e.printStackTrace();
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.getWriter().write("{\"ok\":false,\"error\":\"server_error\"}");
        }
    }

    private void handleStart(HttpServletRequest req, HttpServletResponse resp, HttpSession session, String username) throws IOException, SQLException {
        // bloque si partie en cours
        BJState existing = (BJState) session.getAttribute("bjState");
        if (existing != null && !existing.finished) {
            resp.setStatus(HttpServletResponse.SC_CONFLICT);
            resp.getWriter().write("{\"ok\":false,\"error\":\"game_in_progress\"}");
            return;
        }

        // lire le bet de façon robuste
        int bet;
        JsonObject body;
        try (BufferedReader r = req.getReader()) {
            body = gson.fromJson(r, JsonObject.class);
        }
        if (body == null || !body.has("bet") || !body.get("bet").isJsonPrimitive()) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"ok\":false,\"error\":\"invalid_json\"}");
            return;
        }
        try {
            bet = body.get("bet").getAsInt();
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"ok\":false,\"error\":\"invalid_bet\"}");
            return;
        }
        if (bet <= 0) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"ok\":false,\"error\":\"invalid_bet\"}");
            return;
        }

        // chargement user
        UserDao.UserRow u = UserDao.getByUsername(username);
        if (u == null) {
            resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            resp.getWriter().write("{\"ok\":false,\"error\":\"unauthorized\"}");
            return;
        }
        if (u.credits < bet) {
            resp.setStatus(HttpServletResponse.SC_CONFLICT); // pas assez de crédits
            resp.getWriter().write("{\"ok\":false,\"error\":\"insufficient_credits\"}");
            return;
        }

        // débit immédiat
        int credits = u.credits - bet;
        UserDao.updateCredits(u.id, credits);
        session.setAttribute("credits", credits);

        // init state
        BJState st = new BJState();
        st.deck = buildShuffledDeck();
        st.bet = bet;

        // distribution: joueur, dealer, joueur, dealer
        st.player.add(draw(st.deck));
        st.dealer.add(draw(st.deck));
        st.player.add(draw(st.deck));
        st.dealer.add(draw(st.deck));

        session.setAttribute("bjState", st);

        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        JsonObject stateJson = stateToJson(st, false);
        stateJson.addProperty("playerValue", handValue(st.player));
        out.add("state", stateJson);
        out.addProperty("credits", credits);
        resp.getWriter().write(out.toString());
    }


    private void handleHit(HttpServletResponse resp, HttpSession session, String username) throws IOException, SQLException {
        BJState st = (BJState) session.getAttribute("bjState");
        if (st == null || st.finished) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"ok\":false,\"error\":\"no_game\"}");
            return;
        }

        st.player.add(draw(st.deck));
        int pVal = handValue(st.player);
        if (pVal > 21) {
            st.status = "player_bust";
            st.finished = true;
            // pas de payout
            logGame(username, st, 0);
        }

        int credits = (int) session.getAttribute("credits");
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.add("state", stateToJson(st, false));
        out.addProperty("credits", credits);
        resp.getWriter().write(out.toString());
    }

    private void handleStand(HttpServletResponse resp, HttpSession session, String username) throws IOException, SQLException {
        BJState st = (BJState) session.getAttribute("bjState");
        if (st == null || st.finished) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"ok\":false,\"error\":\"no_game\"}");
            return;
        }

        // Le croupier joue: tire jusqu'à ≥17
        while (handValue(st.dealer) < 17) {
            st.dealer.add(draw(st.deck));
        }

        int p = handValue(st.player);
        int d = handValue(st.dealer);

        int payout = 0;
        if (d > 21) {
            st.status = "dealer_bust";
            payout = st.bet * 2; // 1:1 (on a déjà débité la mise)
        } else if (p > d) {
            st.status = "player_win";
            payout = st.bet * 2;
        } else if (p < d) {
            st.status = "dealer_win";
            payout = 0;
        } else {
            st.status = "push";
            payout = st.bet; // on rend la mise
        }
        st.finished = true;

        // crédits
        int credits = (int) session.getAttribute("credits");
        credits += payout;
        session.setAttribute("credits", credits);

        // DB
        String uname = (String) session.getAttribute("user");
        UserDao.UserRow uRow = UserDao.getByUsername(uname);
        if (uRow != null) {
            UserDao.updateCredits(uRow.id, credits);
            logGame(username, st, payout);
        }

        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.add("state", stateToJson(st, true)); // dealer face up
        out.addProperty("payout", payout);
        out.addProperty("credits", credits);
        resp.getWriter().write(out.toString());
    }

    // --- Utils BJ ---

    private static Deque<String> buildShuffledDeck() {
        String[] ranks = {"A","2","3","4","5","6","7","8","9","10","J","Q","K"};
        String[] suits = {"S","H","D","C"}; // ♠ ♥ ♦ ♣ (S,H,D,C)
        List<String> cards = new ArrayList<>(52);
        for (String r : ranks) for (String s : suits) cards.add(r + s);
        Collections.shuffle(cards, new Random());
        return new ArrayDeque<>(cards);
    }

    private static String draw(Deque<String> deck) {
        String c = deck.pollFirst();
        if (c == null) {
            // deck vide → on en reconstruit un
            Deque<String> newDeck = buildShuffledDeck();
            c = newDeck.pollFirst();
            // on remplace le deck passé en paramètre
            deck.addAll(newDeck);
        }
        return c;
    }


    private static int handValue(List<String> hand) {
        int total = 0, aces = 0;
        for (String c : hand) {
            String r = c.substring(0, c.length()-1);
            switch (r) {
                case "A": aces++; total += 11; break;
                case "K":
                case "Q":
                case "J": total += 10; break;
                default:  total += Integer.parseInt(r);
            }
        }
        while (total > 21 && aces > 0) { total -= 10; aces--; } // A=11→1
        return total;
    }

    private static JsonObject stateToJson(BJState st, boolean revealDealer) {
        JsonObject js = new JsonObject();
        // joueur
        js.add("player", toJsonArray(st.player));
        // dealer (cache la première carte si playing)
        if (!revealDealer && !st.finished) {
            List<String> d = new ArrayList<>(st.dealer);
            if (!d.isEmpty()) d.set(0, "??");
            js.add("dealer", toJsonArray(d));
        } else {
            js.add("dealer", toJsonArray(st.dealer));
        }
        js.addProperty("status", st.status);
        return js;
    }

    private static com.google.gson.JsonArray toJsonArray(List<String> list) {
        com.google.gson.JsonArray arr = new com.google.gson.JsonArray();
        for (String s : list) arr.add(s);
        return arr;
    }

    private void logGame(String username, BJState st, int payout) throws SQLException {
        UserDao.UserRow u = UserDao.getByUsername(username);
        if (u == null) return;
        JsonObject result = new JsonObject();
        result.addProperty("status", st.status);
        result.add("player", toJsonArray(st.player));
        result.add("dealer", toJsonArray(st.dealer));
        result.addProperty("payout", payout);
        UserDao.insertGameLog(u.id, "BLACKJACK", st.bet, result.toString());
    }
}
