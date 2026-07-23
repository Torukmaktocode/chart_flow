import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Error en la aplicación</h2>
          <p>{this.state.error?.message || "Ocurrió un error inesperado"}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
