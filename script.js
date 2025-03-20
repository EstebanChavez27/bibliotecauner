let booksData = [];

async function loadBooks() {
    try {
        const response = await fetch('books.json'); // Carga el JSON
        booksData = await response.json();
        renderBooks(); // Llama a la función que renderiza los libros
    } catch (error) {
        console.error('Error cargando libros:', error);
    }
}

// Llama a la función para cargar los libros cuando se cargue la página
document.addEventListener('DOMContentLoaded', loadBooks);


// Estructura de la página
const structure = {
    "1er-ano": {
        "1er-cuatrimestre": {
            "materias": [
                "01. Introducción a la Informática",
                "02. Programación I",
                "03. Arquitectura de Computadoras"
            ]
        },
        "2do-cuatrimestre": {
            "materias": [
                "04. Programación II",
                "05. Sistemas Operativos",
                "06. Bases de Datos",
                "07. Introducción al Desarrollo Web"
            ]
        }
    },
    "2do-ano": {
        "1er-cuatrimestre": {
            "materias": [
                "08. Redes de Datos",
                "09. Diseño Gráfico",
                "10. Programación III"
            ]
        },
        "2do-cuatrimestre": {
            "materias": [
                "11. Ingeniería de Software",
                "12. Desarrollo de Aplicaciones Web",
                "13. Desarrollo para Móviles",
                "14. Multimedia y Juegos en Web",
                "15. Seguridad Informática" // Esta categoría no tiene libros
            ]
        }
    }
};

// Mapa para relacionar categorías con años y cuatrimestres
const categoryMap = {
    "01. Introducción a la Informática": { year: "1er-ano", semester: "1er-cuatrimestre" },
    "02. Programación I": { year: "1er-ano", semester: "1er-cuatrimestre" },
    "03. Arquitectura de Computadoras": { year: "1er-ano", semester: "1er-cuatrimestre" },
    "04. Programación II": { year: "1er-ano", semester: "2do-cuatrimestre" },
    "05. Sistemas Operativos": { year: "1er-ano", semester: "2do-cuatrimestre" },
    "06. Bases de Datos": { year: "1er-ano", semester: "2do-cuatrimestre" },
    "07. Introducción al Desarrollo Web": { year: "1er-ano", semester: "2do-cuatrimestre" },
    "08. Redes de Datos": { year: "2do-ano", semester: "1er-cuatrimestre" },
    "09. Diseño Gráfico": { year: "2do-ano", semester: "1er-cuatrimestre" },
    "10. Programación III": { year: "2do-ano", semester: "1er-cuatrimestre" },
    "11. Ingeniería de Software": { year: "2do-ano", semester: "2do-cuatrimestre" },
    "12. Desarrollo de Aplicaciones Web": { year: "2do-ano", semester: "2do-cuatrimestre" },
    "13. Desarrollo para Móviles": { year: "2do-ano", semester: "2do-cuatrimestre" },
    "14. Multimedia y Juegos en Web": { year: "2do-ano", semester: "2do-cuatrimestre" },
    "15. Seguridad Informática": { year: "2do-ano", semester: "2do-cuatrimestre" }
};

// Funciones para renderizar el contenido
function renderBooks(filter = 'all') {
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = '';

    const years = Object.keys(structure);
    
    years.forEach(year => {
        // Si hay un filtro y no coincide, saltar este año
        if (filter !== 'all' && filter !== year) return;

        const yearContainer = document.createElement('div');
        yearContainer.className = 'year-container';
        const yearFormatted = year === "1er-ano" ? "1er Año" : "2do Año";
yearContainer.innerHTML = `<h2 class="year-title">${yearFormatted}</h2>`;

        
        const semesters = Object.keys(structure[year]);
        
        semesters.forEach(semester => {
            const semesterContainer = document.createElement('div');
            semesterContainer.className = 'semester-container';
            semesterContainer.innerHTML = `<h3 class="semester-title">${semester.replace('-', ' ')}</h3>`;
            
            const materias = structure[year][semester]["materias"];
            
            materias.forEach(materia => {
                const materiaContainer = document.createElement('div');
                materiaContainer.className = 'materia-container';
                materiaContainer.innerHTML = `<h4 class="materia-title">${materia}</h4>`;
                
                // Obtener libros para esta materia
                const materiaBooks = booksData.filter(book => 
                    book.categories.includes(materia)
                );
                
                if (materiaBooks.length > 0) {
                    const booksContainer = document.createElement('div');
                    booksContainer.className = 'books-container';
                    
                    materiaBooks.forEach(book => {
                        booksContainer.appendChild(createBookCard(book));
                    });
                    
                    materiaContainer.appendChild(booksContainer);
                } else {
                    // Mensaje cuando no hay libros en la materia
                    const noBooks = document.createElement('div');
                    noBooks.className = 'no-books-message';
                    noBooks.textContent = 'Aún no se subieron libros para esta materia';
                    materiaContainer.appendChild(noBooks);
                }
                
                semesterContainer.appendChild(materiaContainer);
            });
            
            yearContainer.appendChild(semesterContainer);
        });
        
        mainContent.appendChild(yearContainer);
    });
}

function createBookCard(book) {
    const bookCard = document.createElement('div');
    bookCard.className = 'book-card';
    bookCard.dataset.id = book.id;
    
    // Crear la etiqueta de tipo (Obligatoria/Optativa)
    const badgeClass = book.type === 'Obligatoria' ? 'badge-obligatory' : 'badge-optional';
    
    bookCard.innerHTML = `
        <div class="book-cover">
            <span class="book-badge ${badgeClass}">${book.type}</span>
            <img src="${book.cover}" alt="${book.title}">
        </div>
        <div class="book-info">
            <h3 class="book-title">${book.title}</h3>
            <div class="book-actions">
                <button class="btn download-btn" data-id="${book.id}"><svg width="20" height="20" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg" transform="rotate(0 0 0)">
<path d="M13.1739 4C13.1739 3.58579 12.8381 3.25 12.4239 3.25C12.0096 3.25 11.6739 3.58579 11.6739 4L11.6739 10.6254L7.79691 10.6254C7.49352 10.6254 7.22001 10.8082 7.10395 11.0885C6.98789 11.3688 7.05215 11.6914 7.26674 11.9059L11.8763 16.5126C12.0132 16.6587 12.2079 16.75 12.4239 16.75C12.6566 16.75 12.8646 16.644 13.0021 16.4776L17.5771 11.9059C17.7917 11.6915 17.8559 11.3688 17.7399 11.0885C17.6238 10.8082 17.3503 10.6254 17.0469 10.6254H13.1739L13.1739 4Z" fill="#343C54"/>
<path d="M5.17188 16C5.17188 15.5858 4.83609 15.25 4.42188 15.25C4.00766 15.25 3.67188 15.5858 3.67188 16V18.5C3.67188 19.7426 4.67923 20.75 5.92188 20.75H18.9227C20.1654 20.75 21.1727 19.7426 21.1727 18.5V16C21.1727 15.5858 20.837 15.25 20.4227 15.25C20.0085 15.25 19.6727 15.5858 19.6727 16V18.5C19.6727 18.9142 19.337 19.25 18.9227 19.25H5.92188C5.50766 19.25 5.17188 18.9142 5.17188 18.5V16Z" fill="#343C54"/>
</svg>
</button>
                <button class="btn share-btn" data-id="${book.id}"><svg width="20" height="20" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg" transform="rotate(0 0 0)">
<path d="M15.0928 2.37789C14.8783 2.1634 14.5558 2.09923 14.2755 2.21532C13.9952 2.3314 13.8125 2.60488 13.8125 2.90823V6.75455C7.39629 7.14206 2.3125 12.4683 2.3125 18.982C2.3125 19.8676 2.4066 20.7321 2.58563 21.5657C2.65986 21.9113 2.96538 22.1582 3.31891 22.1582C3.67244 22.1582 3.97796 21.9113 4.05219 21.5657C5.04239 16.955 8.99081 13.4426 13.8125 13.1102V16.9082C13.8125 17.2116 13.9952 17.4851 14.2755 17.6011C14.5558 17.7172 14.8783 17.6531 15.0928 17.4386L22.0929 10.4386C22.2335 10.2979 22.3125 10.1071 22.3125 9.90823C22.3125 9.70932 22.2335 9.51855 22.0929 9.3779L15.0928 2.37789Z" fill="#343C54"/>
</svg>
</button>
            </div>
        </div>
    `;
    
    bookCard.addEventListener('click', function(e) {
        if (!e.target.classList.contains('btn')) {
            openBookModal(book.id);
        }
    });
    
    return bookCard;
}

function openBookModal(bookId) {
    const book = booksData.find(book => book.id === bookId);
    if (!book) return;
    
    const badgeClass = book.type === 'Obligatoria' ? 'badge-obligatory' : 'badge-optional';
    
    // Crear lista de categorías a las que pertenece el libro
    const categoriesHTML = book.categories.map(category => {
        const categoryInfo = categoryMap[category];
        return `<li>${category} (${categoryInfo.year.replace('-', ' ')} - ${categoryInfo.semester.replace('-', ' ')})</li>`;
    }).join('');
    
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <h2 class="modal-book-title">${book.title}</h2>
        <div class="modal-book-info">
            <div class="modal-book-cover">
                <span class="book-badge ${badgeClass}">${book.type}</span>
                <img src="${book.cover}" alt="${book.title}">
            </div>
            <div class="modal-book-details">
                <div class="modal-book-metadata">
                    <p><strong>Autor:</strong> ${book.author || 'No especificado'}</p>
                    <p><strong>Año:</strong> ${book.year || 'No especificado'}</p>
                </div>
                <p class="modal-book-description">${book.description}</p>
                <p><strong>Categorías:</strong></p>
                <ul class="modal-book-categories">
                    ${categoriesHTML}
                </ul>
                <div class="modal-book-actions">
                    <a href="${book.driveLink}" class="btn download-btn" target="_blank">Descargar</a>
                    <button class="btn share-btn" data-link="${book.driveLink}">Compartir Enlace</button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.getElementById('bookModal');
    modal.style.display = 'block';
    
    const shareBtn = modalContent.querySelector('.share-btn');
    shareBtn.addEventListener('click', function() {
        shareBook(book.driveLink, book.title);
    });
}

function closeBookModal() {
    const modal = document.getElementById('bookModal');
    modal.style.display = 'none';
}

function shareBook(link, title) {
    if (navigator.share) {
        navigator.share({
            title: title,
            text: `Échale un vistazo a este libro: ${title}`,
            url: link
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(link).then(() => {
            alert('Enlace copiado al portapapeles');
        }).catch(err => {
            console.error('Error al copiar el enlace:', err);
        });
    }
}

function setupEventListeners() {
    // Botones de categoría
// Función para actualizar las opciones de materia según el filtro
function updateSubjectOptions() {
    const year = document.getElementById('yearSelect').value;
    const semester = document.getElementById('semesterSelect').value;
    
    // Limpiar las opciones anteriores
    const subjectSelect = document.getElementById('subjectSelect');
    subjectSelect.innerHTML = '<option value="all">Todas las materias</option>';
    
    // Verificar las materias disponibles según el filtro
    const subjects = new Set();
    for (let yearKey in structure) {
        if (year === 'all' || year === yearKey) {
            for (let semesterKey in structure[yearKey]) {
                if (semester === 'all' || semester === semesterKey) {
                    structure[yearKey][semesterKey]["materias"].forEach(materia => {
                        subjects.add(materia);
                    });
                }
            }
        }
    }

    // Llenar el selector de materias con las opciones filtradas
    subjects.forEach(materia => {
        const option = document.createElement('option');
        option.value = materia;
        option.textContent = materia;
        subjectSelect.appendChild(option);
    });
}

// Función para filtrar y renderizar los libros según los filtros seleccionados
function renderFilteredBooks() {
    const year = document.getElementById('yearSelect').value;
    const semester = document.getElementById('semesterSelect').value;
    const subject = document.getElementById('subjectSelect').value;
    const type = document.getElementById('typeSelect').value;

    const filteredBooks = booksData.filter(book => {
        const bookCategory = categoryMap[book.categories[0]];
        const matchesYear = year === 'all' || bookCategory.year === year;
        const matchesSemester = semester === 'all' || bookCategory.semester === semester;
        const matchesSubject = subject === 'all' || book.categories.includes(subject);
        const matchesType = type === 'all' || book.type === type;

        return matchesYear && matchesSemester && matchesSubject && matchesType;
    });

    renderBooksList(filteredBooks);
}

// Función para renderizar los libros filtrados en la página
function renderBooksList(filteredBooks) {
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = '';

    if (filteredBooks.length === 0) {
        mainContent.innerHTML = '<p style="text-align: center;">No se encontraron libros para los filtros seleccionados.</p>';
        return;
    }

    const booksContainer = document.createElement('div');
    booksContainer.className = 'books-container';
    
    filteredBooks.forEach(book => {
        booksContainer.appendChild(createBookCard(book));
    });
    
    mainContent.appendChild(booksContainer);
    
}

// Configurar eventos para los selectores de filtro
document.getElementById('yearSelect').addEventListener('change', function() {
    updateSubjectOptions();
    renderFilteredBooks();
});
document.getElementById('semesterSelect').addEventListener('change', renderFilteredBooks);
document.getElementById('subjectSelect').addEventListener('change', renderFilteredBooks);
document.getElementById('typeSelect').addEventListener('change', renderFilteredBooks);

// Inicializar la página con los filtros adecuados
document.addEventListener('DOMContentLoaded', function() {
    updateSubjectOptions();
    renderFilteredBooks(); // Mostrar todos los libros al principio
});


// Función para limpiar los filtros
function clearFilters() {
    // Restablecer todos los filtros a sus valores por defecto
    document.getElementById('yearSelect').value = 'all';
    document.getElementById('semesterSelect').value = 'all';
    document.getElementById('subjectSelect').value = 'all';
    document.getElementById('typeSelect').value = 'all';

    // Actualizar las opciones de materia
    updateSubjectOptions();

    // Renderizar los libros sin filtros
    renderFilteredBooks();
}

// Configurar el evento del botón "Limpiar"
document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);

    
    // Cerrar modal
    document.getElementById('closeModal').addEventListener('click', closeBookModal);
    
    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('bookModal');
        if (event.target === modal) {
            closeBookModal();
        }
    });
    
    // Búsqueda
    document.getElementById('searchInput').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm.length > 2) {
            const filteredBooks = booksData.filter(book => 
                book.title.toLowerCase().includes(searchTerm) || 
                book.description.toLowerCase().includes(searchTerm) || 
                book.categories.some(category => category.toLowerCase().includes(searchTerm))
            );
            
            renderSearchResults(filteredBooks);
        } else if (searchTerm.length === 0) {
            // Restaurar vista normal
            const activeFilter = document.querySelector('.category-btn.active').dataset.year;
            renderBooks(activeFilter);
        }
    });
    
    // Botones de descarga y compartir
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('download-btn')) {
            const bookId = parseInt(e.target.dataset.id);
            if (bookId) {
                const book = booksData.find(b => b.id === bookId);
                if (book) {
                    window.open(book.driveLink, '_blank');
                }
            }
            e.stopPropagation();
        }
        
        if (e.target.classList.contains('share-btn')) {
            const bookId = parseInt(e.target.dataset.id);
            if (bookId) {
                const book = booksData.find(b => b.id === bookId);
                if (book) {
                    shareBook(book.driveLink, book.title);
                }
            }
            e.stopPropagation();
        }
    });
}

function renderSearchResults(books) {
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = '';
    
    if (books.length === 0) {
        mainContent.innerHTML = '<p style="text-align: center; margin-top: 2rem;">No se encontraron resultados.</p>';
        return;
    }
    
    const searchResultsContainer = document.createElement('div');
    searchResultsContainer.className = 'year-container';
    searchResultsContainer.innerHTML = `<h2 class="year-title">Resultados de búsqueda</h2>`;
    
    const booksContainer = document.createElement('div');
    booksContainer.className = 'books-container';
    
    books.forEach(book => {
        booksContainer.appendChild(createBookCard(book));
    });
    
    searchResultsContainer.appendChild(booksContainer);
    mainContent.appendChild(searchResultsContainer);
}

// Inicializar la página
document.addEventListener('DOMContentLoaded', function() {
    renderBooks();
    setupEventListeners();
});

function createBookCard(book) {
    const bookCard = document.createElement('div');
    bookCard.className = 'book-card';
    bookCard.dataset.id = book.id;

    // Crear la etiqueta de tipo (Obligatoria/Optativa)
    const badgeClass = book.type === 'Obligatoria' ? 'badge-obligatory' : 'badge-optional';

    bookCard.innerHTML = `
        <div class="book-cover">
            <span class="book-badge ${badgeClass}">${book.type}</span>
            <img src="${book.cover}" alt="${book.title}">
            <div class="book-actions-overlay">
                <button class="btn download-btn" data-id="${book.id}"><svg width="20" height="20" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg" transform="rotate(0 0 0)">
<path d="M13.1739 4C13.1739 3.58579 12.8381 3.25 12.4239 3.25C12.0096 3.25 11.6739 3.58579 11.6739 4L11.6739 10.6254L7.79691 10.6254C7.49352 10.6254 7.22001 10.8082 7.10395 11.0885C6.98789 11.3688 7.05215 11.6914 7.26674 11.9059L11.8763 16.5126C12.0132 16.6587 12.2079 16.75 12.4239 16.75C12.6566 16.75 12.8646 16.644 13.0021 16.4776L17.5771 11.9059C17.7917 11.6915 17.8559 11.3688 17.7399 11.0885C17.6238 10.8082 17.3503 10.6254 17.0469 10.6254H13.1739L13.1739 4Z" fill="#343C54"/>
<path d="M5.17188 16C5.17188 15.5858 4.83609 15.25 4.42188 15.25C4.00766 15.25 3.67188 15.5858 3.67188 16V18.5C3.67188 19.7426 4.67923 20.75 5.92188 20.75H18.9227C20.1654 20.75 21.1727 19.7426 21.1727 18.5V16C21.1727 15.5858 20.837 15.25 20.4227 15.25C20.0085 15.25 19.6727 15.5858 19.6727 16V18.5C19.6727 18.9142 19.337 19.25 18.9227 19.25H5.92188C5.50766 19.25 5.17188 18.9142 5.17188 18.5V16Z" fill="#343C54"/>
</svg></button>
                <button class="btn share-btn" data-id="${book.id}"><svg width="20" height="20" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg" transform="rotate(0 0 0)">
<path d="M15.0928 2.37789C14.8783 2.1634 14.5558 2.09923 14.2755 2.21532C13.9952 2.3314 13.8125 2.60488 13.8125 2.90823V6.75455C7.39629 7.14206 2.3125 12.4683 2.3125 18.982C2.3125 19.8676 2.4066 20.7321 2.58563 21.5657C2.65986 21.9113 2.96538 22.1582 3.31891 22.1582C3.67244 22.1582 3.97796 21.9113 4.05219 21.5657C5.04239 16.955 8.99081 13.4426 13.8125 13.1102V16.9082C13.8125 17.2116 13.9952 17.4851 14.2755 17.6011C14.5558 17.7172 14.8783 17.6531 15.0928 17.4386L22.0929 10.4386C22.2335 10.2979 22.3125 10.1071 22.3125 9.90823C22.3125 9.70932 22.2335 9.51855 22.0929 9.3779L15.0928 2.37789Z" fill="#343C54"/>
</svg></button>
            </div>
        </div>
        <div class="book-info">
            <h3 class="book-title">${book.title}</h3>
        </div>
    `;

    bookCard.addEventListener('click', function (e) {
        if (!e.target.classList.contains('btn')) {
            openBookModal(book.id);
        }
    });

    return bookCard;
}

