<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">Servicio de Profesores - Sistema Escolar</h1>

## 📝 Descripción

Este repositorio contiene el código fuente del **Servicio de Profesores**, un microservicio clave del backend del Sistema de Gestión Escolar. Ha sido desarrollado con **[NestJS](https://nestjs.com)** para ofrecer un backend eficiente y modular que potencie todas las funcionalidades del dashboard del profesor.

Sus responsabilidades principales son:
-   **Gestión de Cursos y Carga Académica:** Provee los endpoints para que los profesores consulten sus cursos asignados, horarios y métricas asociadas.
-   **Toma de Asistencia:** Maneja toda la lógica para registrar y consultar la asistencia de los estudiantes en tiempo real.
-   **Administración de Calificaciones:** Permite a los profesores crear evaluaciones, ingresar y modificar calificaciones.
-   **Gestión de Observaciones:** Centraliza el registro (CRUD) de observaciones académicas o conductuales sobre los estudiantes.
-   **Consulta de Datos Estudiantiles:** Ofrece acceso a la información detallada de los alumnos que pertenecen a los cursos del profesor.

---

## 🛠️ Tecnologías Utilizadas

-   **Framework:** [NestJS](https://nestjs.com/)
-   **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
---

## ▶️ Ejecutando la Aplicación

```bash
# Modo desarrollo con recarga automática
$ pnpm run start:dev

# Modo producción
$ pnpm run start:prod
