package com.sae502.servlets;

import org.json.JSONArray;
import org.json.JSONObject;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Random;

/**
 * Slot endpoints:
 *  - POST /api/slot/spin   : debit bet, return { grid, credits }
 *  - POST /api/slot/settle : credit payout, return { ok, credits }
 *
 * Front expects grid as an array of 5 columns, each column = [top, mid, bot] with indices 0..9.
 */
@WebServlet(urlPatterns = "/api/slot/*")
public class SlotServlet extends HttpServlet {

    // Layout & symbols (adapt if needed)
    private static final int COLS = 5;
    private static final int ROWS = 3;
    private static final int SYMBOL_CNT = 10;

    private final Random rng = new Random();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setCharacterEncoding("UTF-8");
        resp.setContentType("application/json; charset=UTF-8");

        String path = req.getPathInfo(); // "/spin" or "/settle"
        Integer userId = (Integer) req.getSession().getAttribute("userId");
        if (userId == null) {
            writeJson(resp, 401, new JSONObject().put("error", "unauth"));
            return;
        }

        JSONObject body = readJson(req);

        try {
            if ("/spin".equals(path)) {
                // Bet is TOTAL bet (e.g., lines * stake). Lines are for info/analytics here.
                int bet   = Math.max(0, body.optInt("bet", 1));
                int lines = Math.max(1, body.optInt("lines", 1));

                // 1) Debit in DB (guard: enough credits)
                Integer credits = UserDao.debitCreditsIfEnough(userId, bet);
                req.getSession().setAttribute("credits", credits); // session en phase avec la DB

                if (credits == null) {
                    writeJson(resp, 402, new JSONObject().put("error", "insufficient_credits"));
                    return;
                }

                // 2) Generate grid (column-major: [ [top,mid,bot], ... x5 ])
                int[][] grid = generateGrid();

                // 3) Build response
                JSONObject out = new JSONObject();
                out.put("grid", toJsonGrid(grid));
                out.put("credits", credits); // current balance after debit
                // If you compute payout server-side, you can also: out.put("payout", payout);
                writeJson(resp, 200, out);
                return;
            }

            if ("/settle".equals(path)) {
                // Credit payout in DB; if payout <= 0, just echo back current credits
                int payout = Math.max(0, body.optInt("payout", 0));
                int credits = (payout > 0) ? UserDao.addCredits(userId, payout)
                        : UserDao.getCredits(userId);

                req.getSession().setAttribute("credits", credits); // idem


                JSONObject out = new JSONObject()
                        .put("ok", true)
                        .put("credits", credits);
                writeJson(resp, 200, out);
                return;
            }

            writeJson(resp, 404, new JSONObject().put("error", "unknown_path"));

        } catch (Exception e) {
            // Avoid leaking stack traces; send message for quick debugging
            writeJson(resp, 500, new JSONObject().put("error", safeMsg(e)));
        }
    }

    // --- Helpers -------------------------------------------------------------

    private JSONObject readJson(HttpServletRequest req) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = req.getReader()) {
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
        }
        String s = sb.toString().trim();
        return s.isEmpty() ? new JSONObject() : new JSONObject(s);
    }

    private void writeJson(HttpServletResponse resp, int status, JSONObject obj) throws IOException {
        resp.setStatus(status);
        try (PrintWriter w = resp.getWriter()) {
            w.write(obj.toString());
        }
    }

    private String safeMsg(Exception e) {
        String m = e.getMessage();
        return (m == null) ? e.getClass().getSimpleName() : m.replace("\"", "'");
    }

    private JSONArray toJsonGrid(int[][] grid) {
        JSONArray cols = new JSONArray();
        for (int c = 0; c < COLS; c++) {
            JSONArray col = new JSONArray();
            for (int r = 0; r < ROWS; r++) {
                col.put(grid[c][r]);
            }
            cols.put(col);
        }
        return cols;
    }

    /**
     * Generates a grid as an array of 5 columns, each = [top, mid, bot].
     * Here we simply choose a random top, then mid/bot follow the strip order:
     * mid=(top+1)%N, bot=(top+2)%N, like a continuous reel strip.
     * Replace with your own generator if you already have one.
     */
    private int[][] generateGrid() {
        int[][] grid = new int[COLS][ROWS];
        for (int c = 0; c < COLS; c++) {
            int top = rng.nextInt(SYMBOL_CNT);
            grid[c][0] = top;
            grid[c][1] = (top + 1) % SYMBOL_CNT;
            grid[c][2] = (top + 2) % SYMBOL_CNT;
        }
        return grid;
    }
}