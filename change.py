# Fungsi untuk memperbarui file
def update_file(file_path):
    try:
        # Membuka dan membaca isi file
        with open(file_path, "r") as file:
            file_content = file.read()

        # Mengubah kode sesuai dengan instruksi
        file_content = file_content.replace(
            "const amount = ethers.parseUnits('1.5', 'ether');",
            "const amount = ethers.parseUnits('1', 'ether');"
        )
        file_content = file_content.replace(
            "const values = recipients.map(() => ethers.parseUnits('1.5', 'ether'));",
            "const values = recipients.map(() => ethers.parseUnits('1', 'ether'));"
        )
        file_content = file_content.replace(
            "value: ethers.parseUnits('1.5', 'ether')",
            "value: ethers.parseUnits('1', 'ether')"
        )
        file_contenr = file_content.replace(
            "const amountCheck = ethers.parseEther('1', 'ether');",
            "const amountCheck = ethers.parseEther('0.5', 'ether');"
        )
        file_contenr = file_content.replace(
            "const amountToUnwrap = ethers.parseUnits('1', 'ether')",
            "const amountToUnwrap = ethers.parseUnits('0.5', 'ether')"
        )
        # Menulis ulang file dengan perubahan
        with open(file_path, "w") as file:
            file.write(file_content)

        print(f"File '{file_path}' berhasil diperbarui!")
    except Exception as e:
        print(f"Terjadi kesalahan saat memperbarui file '{file_path}': {e}")

# Daftar file yang akan diubah
file_paths = ["start.js"]

# Memperbarui semua file
for file_path in file_paths:
    update_file(file_path)
