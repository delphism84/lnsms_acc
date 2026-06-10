import { Outlet } from "react-router-dom";
import { AppBar } from "./AppBar";
import { Footer } from "./Footer";
import styles from "./Layout.module.css";

export function Layout() {
  return (
    <div className={styles.shell}>
      <AppBar />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
