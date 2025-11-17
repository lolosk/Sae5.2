package com.sae502.servlets;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.sae502.servlets.UserDao;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.*;

@WebServlet(urlPatterns = "/api/roulette/*")
public class RouletteServlet extends HttpServlet {

    private final Gson gson = new Gson();
    // numéros rouges (roulette EU)
    private static final Set<Integer> REDS = new HashSet<>(Arrays.asList(
            1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
    ));
    private final Random rng = new Random();

    // ========= Helpers communs =========

    private Integer requireUserId(HttpServletRequest req) throws Exception {
        HttpSession s = req.getSession(false);
        if (s == null) throw new Exception("unauth");
        Integer uid = (Integer) s.getAttribute("userId");
        if (uid != null) return uid;

        // fallback si ta session stocke le username dans "user"
        Object u = s.getAttribute("user");
        if (u instanceof String) {
            UserDao.UserRow row = UserDao.getByUsername((String) u);
            if (row != null) {
                s.setAttribute("userId", row.id);
                s.setAttribute("credits", row.credits);
                return row.id;
            }
        }
        throw new Exception("unauth");
    }

    private JsonObject readJson(HttpServletRequest req) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = req.getReader()) { String line; while ((line = r.readLine()) != null) sb.append(line); }
        String s = sb.toString().trim();
        return s.isEmpty() ? new JsonObject() : gson.fromJson(s, JsonObject.class);
    }

    private void writeJson(HttpServletResponse resp, int status, JsonObject obj) throws IOException {
        resp.setStatus(status);
        resp.setCharacterEncoding("UTF-8");
        resp.setContentType("application/json; charset=UTF-8");
        try (PrintWriter w = resp.getWriter()) { w.write(gson.toJson(obj)); }
    }

    private JsonObject err(String code, String detail){
        JsonObject o = new JsonObject();
        o.addProperty("error", code);
        if (detail != null) o.addProperty("detail", detail);
        return o;
    }

    private String safeMsg(Throwable e){ String m = e.getMessage(); return (m==null)?e.getClass().getSimpleName():m.replace("\"","'"); }

    private int jInt(JsonObject o, String k, int def){ return (o!=null && o.has(k) && o.get(k).isJsonPrimitive()) ? o.get(k).getAsInt() : def; }
    private String jStr(JsonObject o, String k, String def){ return (o!=null && o.has(k) && o.get(k).isJsonPrimitive()) ? o.get(k).getAsString() : def; }
    private Integer jOptInt(JsonObject o, String k){ return (o!=null && o.has(k) && o.get(k).isJsonPrimitive()) ? o.get(k).getAsInt() : null; }

    private JsonArray toJsonBets(java.util.List<UserDao.RouletteBet> bets){
        JsonArray a = new JsonArray();
        for (UserDao.RouletteBet b : bets){
            JsonObject o = new JsonObject();
            o.addProperty("type", b.type);
            o.addProperty("amount", b.amount);
            if (b.param != null) o.addProperty("param", b.param);
            a.add(o);
        }
        return a;
    }

    // ========= GET =========

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getPathInfo();
        try {
            Integer uid = requireUserId(req);
            if ("/state".equals(path)) {
                int balance = UserDao.getCredits(uid);
                java.util.List<UserDao.RouletteBet> bets = UserDao.rouletteListBets(uid);

                // dernier résultat (en session)
                HttpSession s = req.getSession();
                Integer lastNum = (Integer) s.getAttribute("roulette_last_num");
                String  lastCol = (String)  s.getAttribute("roulette_last_col");

                JsonObject out = new JsonObject();
                out.addProperty("balance", balance);
                out.add("bets", toJsonBets(bets));
                if (lastNum != null && lastCol != null) {
                    JsonObject lr = new JsonObject();
                    lr.addProperty("number", lastNum);
                    lr.addProperty("color", lastCol);
                    out.add("lastResult", lr);
                }
                writeJson(resp, 200, out);
                return;
            }
            writeJson(resp, 404, err("unknown_path", path));
        } catch (Throwable e){
            writeJson(resp, 500, err("server_error", safeMsg(e)));
        }
    }

    // ========= DELETE (/bets) =========

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getPathInfo();
        try {
            Integer uid = requireUserId(req);
            if ("/bets".equals(path)) {
                int refund = UserDao.rouletteClearAndRefundTotal(uid);
                int balance = (refund > 0) ? UserDao.addCredits(uid, refund) : UserDao.getCredits(uid);
                req.getSession().setAttribute("credits", balance);

                JsonObject out = new JsonObject();
                out.addProperty("ok", true);
                out.addProperty("balance", balance);
                writeJson(resp, 200, out);
                return;
            }
            writeJson(resp, 404, err("unknown_path", path));
        } catch (Throwable e){
            writeJson(resp, 500, err("server_error", safeMsg(e)));
        }
    }

    // ========= POST =========

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getPathInfo();
        try {
            Integer uid = requireUserId(req);
            JsonObject body = readJson(req);

            if ("/bets".equals(path)) {
                String type = jStr(body, "type", null);
                int amount  = Math.max(0, jInt(body, "amount", 0));
                Integer param = jOptInt(body, "param");

                if (!isValidBet(type, param)) { writeJson(resp, 400, err("invalid_bet", type)); return; }
                if (amount <= 0) { writeJson(resp, 400, err("invalid_amount", String.valueOf(amount))); return; }

                Integer bal = UserDao.debitCreditsIfEnough(uid, amount);
                if (bal == null) { writeJson(resp, 402, err("insufficient_credits", null)); return; }
                req.getSession().setAttribute("credits", bal);

                UserDao.rouletteAddBet(uid, type, amount, param);
                java.util.List<UserDao.RouletteBet> bets = UserDao.rouletteListBets(uid);

                JsonObject out = new JsonObject();
                out.addProperty("balance", bal);
                out.add("bets", toJsonBets(bets));
                writeJson(resp, 200, out);
                return;
            }

            if ("/spin".equals(path)) {
                int n = rng.nextInt(37); // 0..36
                String color = (n==0) ? "green" : (REDS.contains(n) ? "red" : "black");

                java.util.List<UserDao.RouletteBet> bets = UserDao.rouletteListBets(uid);
                int gain = computePayout(bets, n, color);

                int balance = (gain > 0) ? UserDao.addCredits(uid, gain) : UserDao.getCredits(uid);
                UserDao.rouletteClearAndRefundTotal(uid); // refund=0 attendu (mises débitées à la pose)
                req.getSession().setAttribute("credits", balance);

                // garder le dernier résultat
                HttpSession s = req.getSession();
                s.setAttribute("roulette_last_num", n);
                s.setAttribute("roulette_last_col", color);

                JsonObject out = new JsonObject();
                JsonObject res = new JsonObject();
                res.addProperty("number", n);
                res.addProperty("color", color);
                out.add("result", res);
                out.addProperty("gain", gain);
                out.addProperty("balance", balance);
                writeJson(resp, 200, out);
                return;
            }

            writeJson(resp, 404, err("unknown_path", path));
        } catch (Throwable e){
            // renvoie le message dans la réponse pour t’aider à voir l’origine dans DevTools
            writeJson(resp, 500, err("server_error", safeMsg(e)));
        }
    }

    private boolean isValidBet(String type, Integer param){
        if (type == null) return false;
        switch (type){
            case "STRAIGHT": return param != null && 0 <= param && param <= 36;
            case "DOZEN":   return param != null && 1 <= param && param <= 3;
            case "COLUMN":  return param != null && 1 <= param && 1 <= param && param <= 3;
            case "RED": case "BLACK": case "EVEN": case "ODD": case "LOW": case "HIGH":
                return true;
            default: return false;
        }
    }

    private int computePayout(java.util.List<UserDao.RouletteBet> bets, int n, String color){
        int total = 0;
        boolean isRed   = "red".equals(color);
        boolean isBlack = "black".equals(color);
        boolean isGreen = "green".equals(color);

        for (UserDao.RouletteBet b : bets){
            int a = Math.max(0, b.amount);
            switch (b.type) {
                case "STRAIGHT": if (b.param != null && n == b.param) total += a * 36; break; // 35:1 + mise = 36 * mise
                case "DOZEN":
                    if (n==0) break;
                    int dozen = (n-1)/12 + 1; // 1..3
                    if (b.param != null && b.param == dozen) total += a * 3; // 2:1 + mise = 3 * mise
                    break;
                case "COLUMN":
                    if (n==0) break;
                    int col = ((n-1) % 3) + 1; // 1..3
                    if (b.param != null && b.param == col) total += a * 3; // 2:1 + mise = 3 * mise
                    break;
                case "RED":   if (!isGreen && isRed)   total += a*2; break; // 1:1 + mise = 2 * mise
                case "BLACK": if (!isGreen && isBlack) total += a*2; break; // 1:1 + mise = 2 * mise
                case "EVEN":  if (n!=0 && n%2==0)      total += a*2; break; // 1:1 + mise = 2 * mise
                case "ODD":   if (n!=0 && n%2==1)      total += a*2; break; // 1:1 + mise = 2 * mise
                case "LOW":   if (1 <= n && n <= 18)   total += a*2; break; // 1:1 + mise = 2 * mise
                case "HIGH":  if (19 <= n && n <= 36)  total += a*2; break; // 1:1 + mise = 2 * mise
                /* CAS NON IMPLEMENTES CAR FAISANT APPEL AUX PARIS COMBINES QUI COMPLIQUENT BEAUCOUP
                AVEC LE TEMPS RESTANT J'AI PREFRE LAISSER L'UTILISATEUR LE FAIRE LUI-MEME :
                case "SPLIT": LE JOUEUR PARI SUR DEUX NOMBRES VOISINS (Vertical et horizontal)
                    gain (17:1) + mise = 18 * mise
                case "STREET": LE JOUEUR PARI SUR TROIS NOMBRES VOISINS (Vertical et horizontal en bordure)
                    gain (11:1) + mise = 12 * mise
                case "CORNER": LE JOUEUR PARI SUR QUATRES NOMBRES VOISINS (qui forment un carré 2 haut 2 bas)
                    gain (8:1) + mise = 9 * mise
                 */
            }
        }
        return total;
    }
}
